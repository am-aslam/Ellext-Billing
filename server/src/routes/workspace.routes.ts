import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { createSupabaseAdminClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const workspacePayload = z.object({ data: z.record(z.string(), z.unknown()) });

async function getBusinessId(admin: ReturnType<typeof createSupabaseAdminClient>, req: Request): Promise<string> {
  const { data: member, error: memberError } = await admin
    .from('business_members')
    .select('business_id')
    .eq('user_id', req.user?.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memberError) throw memberError;
  if (member?.business_id) return member.business_id;

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .insert({ name: 'Ellext Marketing', legal_name: '' })
    .select('id')
    .single();
  if (businessError || !business) throw businessError || new Error('Could not create the billing workspace.');

  const { error: membershipError } = await admin.from('business_members').insert({
    business_id: business.id,
    user_id: req.user?.id,
    role: req.user?.role || 'STAFF',
  });
  if (membershipError) throw membershipError;
  return business.id;
}

router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = createSupabaseAdminClient();
    const businessId = await getBusinessId(admin, req);
    const { data: settings, error } = await admin.from('business_settings').select('data,updated_at').eq('business_id', businessId).maybeSingle();
    if (error) throw error;
    res.json({ success: true, data: { businessId, workspace: settings?.data || null, updatedAt: settings?.updated_at || null } });
  } catch (error) {
    console.error('workspace load failed', error);
    res.status(503).json({ success: false, error: { code: 'WORKSPACE_UNAVAILABLE', message: 'We could not load your shared billing workspace.' } });
  }
});

router.put('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = workspacePayload.safeParse(req.body);
  if (!parsed.success || JSON.stringify(parsed.data.data).length > 900_000) {
    res.status(400).json({ success: false, error: { code: 'INVALID_WORKSPACE', message: 'The billing workspace data is invalid or too large.' } });
    return;
  }
  try {
    const admin = createSupabaseAdminClient();
    const businessId = await getBusinessId(admin, req);
    const { data: settings, error } = await admin.from('business_settings').upsert({
      business_id: businessId,
      data: parsed.data.data,
      updated_by: req.user?.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id' }).select('data,updated_at').single();
    if (error || !settings) throw error || new Error('Could not save the billing workspace.');
    res.json({ success: true, data: { businessId, workspace: settings.data, updatedAt: settings.updated_at } });
  } catch (error) {
    console.error('workspace save failed', error);
    res.status(503).json({ success: false, error: { code: 'WORKSPACE_UNAVAILABLE', message: 'We could not save your shared billing workspace.' } });
  }
});

export default router;

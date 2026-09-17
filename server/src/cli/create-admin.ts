import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createSupabaseAdminClient } from '../lib/supabase.js';

const rl = readline.createInterface({ input, output });
try { const email = (await rl.question('Admin email: ')).trim().toLowerCase(); const password = await rl.question('Admin password (input hidden by your terminal if supported): '); const name = await rl.question('Full name: '); if (!email || password.length < 8 || !name.trim()) throw new Error('Email, name, and an 8+ character password are required.'); const admin = createSupabaseAdminClient(); const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: name.trim() } }); if (error || !data.user) throw error || new Error('User creation failed.'); const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, email, full_name: name.trim(), role: 'ADMIN', status: 'ACTIVE', email_verified: false }); if (profileError) throw profileError; console.log('Admin created. Configure Supabase email verification before first login.'); } finally { rl.close(); }

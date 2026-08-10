const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ihlixbawhtbjxizfpgel.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobGl4YmF3aHRianhpemZwZ2VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI0NjI5NSwiZXhwIjoyMDk4ODIyMjk1fQ.nvIx9_kNQWVg2eQEcO4y_akFpY7qRqOLFZkTBryizTI'
);

const checkUser = async () => {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) console.error(error);
  
  const user = data.users.find(u => u.email.includes('52503024'));
  if (user) {
    console.log('User found:', user.email);
    
    // Test login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: '12345678'
    });
    
    if (loginError) {
      console.log('Login failed:', loginError.message);
    } else {
      console.log('Login success! Token:', loginData.session.access_token.substring(0, 10));
    }
  } else {
    console.log('User not found.');
  }
};

checkUser();

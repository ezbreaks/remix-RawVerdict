async function triggerReset() {
  const email = 'ezbreaksbaseball@gmail.com';
  console.log(`Triggering password reset for ${email}...`);
  try {
    const response = await fetch('http://localhost:3000/api/auth/reset-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error triggering reset:', error);
  }
}

triggerReset();

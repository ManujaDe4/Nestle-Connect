async function testLogin(username, password) {
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    console.log(`Login ${username}:`, response.status, data);
  } catch (err) {
    console.error(err);
  }
}

async function run() {
  await testLogin('admin', 'password');
  await testLogin('manu', '123');
}

run();



async function testAddRep() {
  try {
    // 1. Log in as admin to get token
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    console.log("Logged in:", loginData.message || "OK");

    // 2. Add rep
    const addRes = await fetch('http://localhost:5000/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        username: 'testrep',
        password: 'password',
        role: 'rep',
        province: 'Western',
        region: 'Colombo',
        area: 'Colombo 01'
      })
    });
    
    const addData = await addRes.json();
    console.log("Add Rep Response:", addRes.status, addData);

  } catch (err) {
    console.error("Test failed:", err);
  }
}

testAddRep();

let tempUsername = '';

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-msg') || document.getElementById('login-error');
    
    if(errorDiv) errorDiv.style.display = 'none';
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.requireOtp) {
                tempUsername = username;
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('otp-form').style.display = 'block';
            } else {
                window.location.href = '/';
            }
        } else {
            if(errorDiv) {
                errorDiv.textContent = data.error || 'Invalid username or password';
                errorDiv.style.display = 'block';
            }
        }
    } catch (err) {
        if(errorDiv) {
            errorDiv.textContent = 'Server error. Please try again.';
            errorDiv.style.display = 'block';
        }
    }
});

document.getElementById('otp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otp = document.getElementById('otp-code').value;
    const errorDiv = document.getElementById('otp-error-msg');
    
    if(errorDiv) errorDiv.style.display = 'none';
    
    try {
        const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: tempUsername, otp })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            window.location.href = '/';
        } else {
            if(errorDiv) {
                errorDiv.textContent = data.error || 'Invalid OTP';
                errorDiv.style.display = 'block';
            }
        }
    } catch (err) {
        if(errorDiv) {
            errorDiv.textContent = 'Server error.';
            errorDiv.style.display = 'block';
        }
    }
});

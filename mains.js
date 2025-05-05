import { signIn, signOut, getToken } from './src/auth.js';
import { loadProfileDataUI } from './src/ui.js';

window.addEventListener('load', () => {
  const token = getToken();
  if (token) loadProfileDataUI();
});

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('identifier').value.trim();
  const pw = document.getElementById('password').value;
  const errDiv = document.getElementById('login-error');
  errDiv.textContent = '';
  try {
    await signIn(id, pw);
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('profile-page').style.display = 'block';
    loadProfileDataUI();
  } catch (err) {
    errDiv.textContent = err.message;
    console.error(err);
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  signOut();
  document.getElementById('login-page').style.display = 'block';
  document.getElementById('profile-page').style.display = 'none';
});

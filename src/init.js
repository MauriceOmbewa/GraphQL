import { initializeAuth } from './auth.js';
import { loadProfileData } from './api.js';

window.addEventListener("load", () => {
    const token = localStorage.getItem("jwt");
    if (token) {
        document.getElementById("login-page").style.display = "none";
        document.getElementById("profile-page").style.display = "block";
        loadProfileData(token);
    }
    initializeAuth();
});
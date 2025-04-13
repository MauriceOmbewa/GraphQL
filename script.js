const domain = "learn.zone01kisumu.ke";

// Correct endpoints
const SIGNIN_ENDPOINT = `https://${domain}/api/auth/signin`;
const GRAPHQL_ENDPOINT = `https://${domain}/api/graphql-engine/v1/graphql`;

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    const loginErrorDiv = document.getElementById('login-error');
    loginErrorDiv.textContent = '';

    try {
        // Construct the Basic auth header value
        const authString = btoa(identifier + ':' + password);

        const response = await fetch(SIGNIN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + authString,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Invalid login credentials');
        }

        const data = await response.json();
        
        const token = data;
        if (!token) {
            throw new Error('No token received');
        }
        
        // Save the token in localStorage
        localStorage.setItem('jwt', token);
        
        // Decode JWT to get user ID
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userId = payload.sub;
        localStorage.setItem('userId', userId);

        // After login, load the profile page
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('profile-page').style.display = 'block';
        loadProfileData(token);
    } catch (error) {
        loginErrorDiv.textContent = error.message;
        console.error("Login error:", error);
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('userId');
    document.getElementById('login-page').style.display = 'block';
    document.getElementById('profile-page').style.display = 'none';
});

// Function to fetch profile data using GraphQL with proper queries
async function loadProfileData(token) {
    // Get userId from localStorage
    const userId = localStorage.getItem('userId');
    
    // This query includes:
    // - Normal query (user table)
    // - Nested query (user -> transactions)
    // - Query with arguments (filtering by userId)
    const query = `
        {
            # Normal query for user info
            user {
                id
                login
            }
            
            # Nested query with arguments for XP transactions
            transaction(where: {userId: {_eq: ${userId}}, type: {_eq: "xp"}}) {
                id
                amount
                createdAt
                path
                object {
                    name
                    type
                }
            }
            
            # Query with arguments for progress data
            progress(where: {userId: {_eq: ${userId}}}) {
                id
                grade
                createdAt
                path
                object {
                    id
                    name
                    type
                }
            }
            
            # Query with arguments for result data
            result(where: {userId: {_eq: ${userId}}}) {
                id
                grade
                createdAt
                path
            }
        }
    `;

    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch profile data');
        }
        
        const result = await response.json();
        
        if (result.errors) {
            throw new Error(result.errors.map(err => err.message).join(', '));
        }
        
        const { user, transaction, progress, result: resultData } = result.data;
        
        // Display user data
        displayUserData(user[0], transaction);
        
        // Process data for graphs
        const xpOverTimeData = processXpOverTimeData(transaction);
        const gradesData = processGradesData(progress, resultData);
        
        // Draw graphs
        drawLineGraph(xpOverTimeData);
        drawBarChart(gradesData);
        
        // Display stats summary
        displayStats(transaction, progress, resultData);
        
    } catch (error) {
        document.getElementById('stats-details').textContent = `Error loading data: ${error.message}`;
        console.error("GraphQL error:", error);
    }
}
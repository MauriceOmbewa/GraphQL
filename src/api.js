import { GRAPHQL_ENDPOINT } from './config.js';
import { displayUserData, displayStats, displayPendingProjects } from './ui.js';
import { processXpOverTimeData, processGradesData } from './data-processor.js';
import { drawLineGraph, drawBarChart } from './graphs.js';

export async function loadProfileData(token) {
    const userId = localStorage.getItem("userId");
    
    const query = `
  {
    user {
      id
      login
      email
      attrs
    }

    transaction(
      where: {
        _and: [
          { type: { _eq: "xp" } },
          { eventId: { _eq: 75 } }
        ]
      }
    ) {
      path
      amount
      type
      createdAt
    }

    progress(
      where: {
        userId: { _eq: ${userId} },
        id: { _neq: 145124 }
      },
      order_by: { createdAt: asc }
    ) {
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

    result(where: { userId: { _eq: ${userId} } }) {
      id
      grade
      createdAt
      path
    }

    # ← your new “pending” query
    pendingProgress: progress(
      where: {
        isDone: { _eq: false },
        eventId: { _eq: 75 },
        id: { _neq: 145124 }
      }
    ) {
      createdAt
      path
    }
  }
        `;

    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) throw new Error("Failed to fetch profile data");
        
        const result = await response.json();
        if (result.errors) throw new Error(result.errors.map(err => err.message).join(", "));

        const { user, transaction, progress, result: resultData, pendingProgress } = result.data;
        
        displayUserData(user[0], transaction);
        drawLineGraph(processXpOverTimeData(transaction));
        drawBarChart(processGradesData(progress, resultData));
        displayStats(transaction, progress, resultData);
        displayPendingProjects(pendingProgress);
    } catch (error) {
        document.getElementById("stats-details").textContent = `Error loading data: ${error.message}`;
        console.error("GraphQL error:", error);
    }
}
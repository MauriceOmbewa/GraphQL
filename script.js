// Correct domain format
const domain = "learn.zone01kisumu.ke";

// Correct endpoints
const SIGNIN_ENDPOINT = `https://${domain}/api/auth/signin`;
const GRAPHQL_ENDPOINT = `https://${domain}/api/graphql-engine/v1/graphql`;

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const identifier = document.getElementById("identifier").value.trim();
  const password = document.getElementById("password").value;
  const loginErrorDiv = document.getElementById("login-error");
  loginErrorDiv.textContent = "";

  try {
    // Construct the Basic auth header value
    const authString = btoa(identifier + ":" + password);

    const response = await fetch(SIGNIN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Basic " + authString,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Invalid login credentials");
    }

    const data = await response.json();

    const token = data;
    if (!token) {
      throw new Error("No token received");
    }

    // Save the token in localStorage
    localStorage.setItem("jwt", token);

    // Decode JWT to get user ID
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.sub;
    localStorage.setItem("userId", userId);

    // After login, load the profile page
    document.getElementById("login-page").style.display = "none";
    document.getElementById("profile-page").style.display = "block";
    loadProfileData(token);
  } catch (error) {
    loginErrorDiv.textContent = error.message;
    console.error("Login error:", error);
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem("jwt");
  localStorage.removeItem("userId");
  document.getElementById("login-page").style.display = "block";
  document.getElementById("profile-page").style.display = "none";
});

// Function to fetch profile data using GraphQL with proper queries
async function loadProfileData(token) {
  // Get userId from localStorage
  const userId = localStorage.getItem("userId");

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
                email
            }
            
            # Nested query with arguments for XP transactions
            transaction(where: { _and: [ { type: { _eq: "xp" } }, { eventId: { _eq: 75 } } ] }) {
                path
                amount
                type
                createdAt
            }
            
            # Query with arguments for progress data
            progress(where: {userId: {_eq: ${userId}} id: {_neq: 145124}} order_by: {createdAt: asc}) {
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("Failed to fetch profile data");
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors.map((err) => err.message).join(", "));
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
    document.getElementById(
      "stats-details"
    ).textContent = `Error loading data: ${error.message}`;
    console.error("GraphQL error:", error);
  }
}

// Function to update the UI with user data
function displayUserData(user, transactions) {
  if (!user) {
    document.getElementById("user-name").textContent =
      "User data not available";
    return;
  }

  document.getElementById("user-name").textContent = user.login || "Unknown";
  document.getElementById("user-email").textContent = user.email || "Unknown";
  // document.getElementById('user-best-skills').textContent = user.bestSkills || 'Unknown';

  // Calculate total XP
  const totalXP = transactions.reduce((sum, t) => sum + t.amount, 0);
  let tot = totalXP;
  if (totalXP >= 1000000) {
    tot = (totalXP / 1000000).toFixed(2);
  } else if (totalXP >= 1000) {
    tot = (totalXP / 1000).toFixed(2);
  } else {
    tot = totalXP.toFixed(2);
  }
  document.getElementById("total-xp").textContent = tot.toLocaleString() + "MB";

  // Set current progress based on most recent transaction
  if (transactions.length > 0) {
    const sortedTx = [...transactions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    document.getElementById("current-progress").textContent =
      sortedTx[0].path.split("/").pop() || "Unknown";
  } else {
    document.getElementById("current-progress").textContent =
      "No progress data";
  }
}

// Function to display statistics
function displayStats(transactions, progress, results) {
  const statsDiv = document.getElementById("stats-details");
  statsDiv.innerHTML = "";

  // Calculate pass/fail ratio
  const passCount = progress.filter((p) => p.grade === 1).length;
  const failCount = progress.filter((p) => p.grade === 0).length;

  const passRatio = (passCount / (passCount + failCount)) * 100 || 0;

  // Create stats display
  const statsHtml = `
        <div class="stat-item">
            <p><strong>Total XP Entries:</strong> ${transactions.length}</p>
            <p><strong>Total Projects Attempted:</strong> ${progress.length}</p>
            <p><strong>Pass Rate:</strong> ${passRatio.toFixed(1)}%</p>
            <p><strong>PASS:</strong> ${passCount} | <strong>FAIL:</strong> ${failCount}</p>
        </div>
    `;

  statsDiv.innerHTML = statsHtml;
}

// Process XP data for the line graph
function processXpOverTimeData(transactions) {
  if (!transactions || transactions.length === 0) return [];

  // Sort transactions by date
  const sortedTx = [...transactions].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  // Group by month
  const monthlyXP = {};
  let cumulativeXP = 0;

  sortedTx.forEach((tx) => {
    const date = new Date(tx.createdAt);
    const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;

    if (!monthlyXP[monthYear]) {
      monthlyXP[monthYear] = 0;
    }

    monthlyXP[monthYear] += tx.amount;
    cumulativeXP += tx.amount;
  });

  // Convert to array format for graph
  return Object.entries(monthlyXP).map(([date, xp]) => ({
    date,
    xp,
  }));
}

// Process grades data for the bar chart
function processGradesData(progress, results) {
  console.log(progress);
  if (!progress || progress.length === 0) return [];

  // Group projects by path
  const projectGroups = {};

  progress.forEach((proj) => {
    // Extract project category from path
    if (proj.path.includes("checkpoint") && proj.path.includes("rust")) {
      const pathParts = proj.path.split("/");
      const category =
        pathParts.length > 1 ? pathParts[pathParts.length - 1] : "Other";

      if (!projectGroups[category]) {
        projectGroups[category] = {
          pass: 0,
          fail: 0,
          total: 0,
        };
      }

      projectGroups[category].total++;
      if (proj.grade === 1) {
        projectGroups[category].pass++;
      } else {
        projectGroups[category].fail++;
      }
    }
  });
  console.log(projectGroups);

  // Convert to array format for graph
  return Object.entries(projectGroups)
    .filter(([category]) => category !== "Other" && category !== "")
    .map(([category, data]) => ({
      label: category,
      pass: data.pass,
      fail: data.fail,
      passRate: data.total > 0 ? (data.pass / data.total) * 100 : 0,
    }));
}

// Function to draw a line graph (XP over time) using SVG
function drawLineGraph(data) {
  const svg = document.getElementById("line-graph");
  // Clear previous content
  svg.innerHTML = "";

  if (!data || data.length === 0) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "50%");
    text.setAttribute("y", "50%");
    text.setAttribute("text-anchor", "middle");
    text.textContent = "No XP data available";
    svg.appendChild(text);
    return;
  }

  // Determine dimensions - INCREASED WIDTH from 800 to 1000
  const width = svg.clientWidth || 700;
  const height = svg.clientHeight || 300;
  const padding = 50;
  // Added more left padding for y-axis labels
  const leftPadding = 90;

  // Add title
  const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
  title.setAttribute("x", width / 2);
  title.setAttribute("y", 20);
  title.setAttribute("text-anchor", "middle");
  title.setAttribute("font-weight", "bold");
  title.textContent = "XP Earned Over Time";
  svg.appendChild(title);

  // Calculate max XP for scaling
  const maxXP = Math.max(...data.map((d) => d.xp));

  // Create axes
  // X axis
  const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  xAxis.setAttribute("x1", leftPadding);
  xAxis.setAttribute("y1", height - padding);
  xAxis.setAttribute("x2", width - padding);
  xAxis.setAttribute("y2", height - padding);
  xAxis.setAttribute("stroke", "black");
  xAxis.setAttribute("stroke-width", "2");
  svg.appendChild(xAxis);

  // Y axis
  const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
  yAxis.setAttribute("x1", leftPadding);
  yAxis.setAttribute("y1", padding);
  yAxis.setAttribute("x2", leftPadding);
  yAxis.setAttribute("y2", height - padding);
  yAxis.setAttribute("stroke", "black");
  yAxis.setAttribute("stroke-width", "2");
  svg.appendChild(yAxis);

  // X axis label
  const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  xLabel.setAttribute("x", width / 2);
  xLabel.setAttribute("y", height - 10);
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.textContent = "Time (Month/Year)";
  svg.appendChild(xLabel);

  // Y axis label - moved further left to avoid clashing with scale numbers
  const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
  yLabel.setAttribute("x", -height / 2);
  yLabel.setAttribute("y", 25); // Moved from 15 to 25 to push it further left
  yLabel.setAttribute("text-anchor", "middle");
  yLabel.setAttribute("transform", "rotate(-90)");
  yLabel.textContent = "XP Earned";
  svg.appendChild(yLabel);

  // Create points for the line graph
  const points = data.map((d, i) => {
    const x =
      leftPadding +
      (i / (data.length - 1 || 1)) * (width - padding - leftPadding);
    const y = height - padding - (d.xp / maxXP) * (height - 2 * padding);
    return { x, y, data: d };
  });

  // Create the path string
  let pathD = `M ${points[0].x} ${points[0].y} `;
  for (let i = 1; i < points.length; i++) {
    pathD += `L ${points[i].x} ${points[i].y} `;
  }

  // Create SVG path element
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  path.setAttribute("stroke", "#007bff");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("fill", "none");
  svg.appendChild(path);

  // Add axis ticks and labels
  // X-axis (dates)
  points.forEach((pt, i) => {
    if (i % Math.ceil(points.length / 5) === 0 || i === points.length - 1) {
      // Tick mark
      const tick = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      tick.setAttribute("x1", pt.x);
      tick.setAttribute("y1", height - padding);
      tick.setAttribute("x2", pt.x);
      tick.setAttribute("y2", height - padding + 5);
      tick.setAttribute("stroke", "black");
      svg.appendChild(tick);

      // Label
      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      label.setAttribute("x", pt.x);
      label.setAttribute("y", height - padding + 20);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "12");
      label.textContent = pt.data.date;
      svg.appendChild(label);
    }
  });

  // Y-axis (XP values)
  for (let i = 0; i <= 5; i++) {
    const yPos = height - padding - (i / 5) * (height - 2 * padding);
    const xpValue = Math.round((i / 5) * maxXP);

    // Tick mark
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("x1", leftPadding - 5);
    tick.setAttribute("y1", yPos);
    tick.setAttribute("x2", leftPadding);
    tick.setAttribute("y2", yPos);
    tick.setAttribute("stroke", "black");
    svg.appendChild(tick);

    // Label - moved further left
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    label.setAttribute("x", leftPadding - 10);
    label.setAttribute("y", yPos + 5);
    label.setAttribute("text-anchor", "end");
    label.setAttribute("font-size", "12");
    label.textContent = xpValue;
    svg.appendChild(label);

    // Grid line (optional)
    const gridLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    gridLine.setAttribute("x1", leftPadding);
    gridLine.setAttribute("y1", yPos);
    gridLine.setAttribute("x2", width - padding);
    gridLine.setAttribute("y2", yPos);
    gridLine.setAttribute("stroke", "#e0e0e0");
    gridLine.setAttribute("stroke-dasharray", "5,5");
    svg.appendChild(gridLine);
  }

  // Add data points with tooltips
  points.forEach((pt) => {
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("cx", pt.x);
    circle.setAttribute("cy", pt.y);
    circle.setAttribute("r", 5);
    circle.setAttribute("fill", "#007bff");

    // Add title for tooltip
    const title = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "title"
    );
    title.textContent = `${pt.data.date}: ${pt.data.xp} XP`;
    circle.appendChild(title);

    svg.appendChild(circle);
  });
}

// Function to draw a bar chart (grades/progress) using SVG
function drawBarChart(data) {
  const svg = document.getElementById("bar-chart");
  svg.innerHTML = "";

  const width = 600;
  const height = svg.clientHeight || 300;
  // margin convention
  const margin = { top: 50, right: 40, bottom: 80, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // set up responsive viewBox
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

  if (!data || data.length === 0) {
    const noData = document.createElementNS(svg.namespaceURI, "text");
    noData.setAttribute("x", width / 2);
    noData.setAttribute("y", height / 2);
    noData.setAttribute("text-anchor", "middle");
    noData.textContent = "No grade data available";
    svg.appendChild(noData);
    return;
  }

  // scales
  const xBand = innerWidth / data.length;
  const barWidth = xBand * 0.7;
  const yScale = (rate) => innerHeight - (rate / 100) * innerHeight;

  // group for margins
  const g = document.createElementNS(svg.namespaceURI, "g");
  g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);

  // title
  const title = document.createElementNS(svg.namespaceURI, "text");
  title.setAttribute("x", width / 2);
  title.setAttribute("y", margin.top / 2);
  title.setAttribute("text-anchor", "middle");
  title.setAttribute("class", "chart-title");
  title.textContent = "Project Success Rates by Category";
  svg.appendChild(title);

  // axes lines
  const axis = (x1, y1, x2, y2, cls = "") => {
    const line = document.createElementNS(svg.namespaceURI, "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("class", cls);
    return line;
  };
  // X axis
  g.appendChild(axis(0, innerHeight, innerWidth * 2, innerHeight, "axis-line"));
  // Y axis
  g.appendChild(axis(0, 0, 0, innerHeight, "axis-line"));

  // Y ticks & grid
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const y = (innerHeight / ticks) * i;
    const pct = 100 - (i / ticks) * 100;

    // grid line
    const grid = axis(0, y, innerWidth, y, "grid-line");
    g.appendChild(grid);

    // tick and label
    const t = document.createElementNS(svg.namespaceURI, "text");
    t.setAttribute("x", -10);
    t.setAttribute("y", y + 4);
    t.setAttribute("text-anchor", "end");
    t.setAttribute("class", "tick-label");
    t.textContent = `${pct}%`;
    g.appendChild(t);

    g.appendChild(axis(-5, y, 0, y, "tick-line"));
  }

  // bars
  data.forEach((d, i) => {
    const x = i * xBand + (xBand - barWidth) / 2;
    const y = yScale(d.passRate);
    const h = innerHeight - y;

    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", barWidth);
    rect.setAttribute("height", h);
    rect.setAttribute("class", "bar");
    rect.setAttribute("rx", 4);
    rect.setAttribute("ry", 4);

    // tooltip
    const tip = document.createElementNS(svg.namespaceURI, "title");
    tip.textContent = `${d.label}: ${d.passRate.toFixed(1)}% (${d.pass}/${
      d.pass + d.fail
    })`;
    rect.appendChild(tip);

    g.appendChild(rect);

    // value label inside bar
    // if (h > 20) {
    //   const vt = document.createElementNS(svg.namespaceURI, 'text');
    //   vt.setAttribute('x', x + barWidth/2);
    //   vt.setAttribute('y', y + 15);
    //   vt.setAttribute('text-anchor', 'middle');
    //   vt.setAttribute('class', 'bar-value');
    // //   vt.textContent = `${d.passRate.toFixed(0)}%`;
    //   g.appendChild(vt);
    // }

    // category label
    const ct = document.createElementNS(svg.namespaceURI, "text");
    ct.setAttribute("x", x + barWidth / 2);
    ct.setAttribute("y", innerHeight + 20);
    ct.setAttribute("text-anchor", data.length > 4 ? "start" : "middle");
    ct.setAttribute(
      "transform",
      data.length > 4
        ? `rotate(45,${x + barWidth / 2},${innerHeight + 20})`
        : ""
    );
    ct.setAttribute("class", "category-label");
    ct.textContent = d.label;
    g.appendChild(ct);
  });

  // legend
  const lx = innerWidth - 80;
  const ly = -margin.top / 2 + 10;
  const lrect = document.createElementNS(svg.namespaceURI, "rect");
  lrect.setAttribute("x", lx);
  lrect.setAttribute("y", ly);
  lrect.setAttribute("width", 15);
  lrect.setAttribute("height", 15);
  lrect.setAttribute("fill", "var(--color-primary)");
  g.appendChild(lrect);

  const ltxt = document.createElementNS(svg.namespaceURI, "text");
  ltxt.setAttribute("x", lx + 20);
  ltxt.setAttribute("y", ly + 12);
  ltxt.setAttribute("class", "legend-text");
  ltxt.textContent = "Pass Rate";
  g.appendChild(ltxt);
}

// Check for a stored JWT on page load
window.addEventListener("load", () => {
  const token = localStorage.getItem("jwt");
  if (token) {
    document.getElementById("login-page").style.display = "none";
    document.getElementById("profile-page").style.display = "block";
    loadProfileData(token);
  }
});

import React from "react";
import "../styles/Dashboard.css"; 


function Dashboard() {
  const username = localStorage.getItem("username");

  return (
    <div className="dashboard-container">
      <h2>Hi{username ? `, ${username}` : ""}! 👋</h2>
      <p>Welcome to your Dashboard.</p>
      <p>Manage your SOC operations efficiently.</p>
    </div>
  );
}

export default Dashboard;

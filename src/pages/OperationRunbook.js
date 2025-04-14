import { useState } from "react";
import "../styles/OperationRunbook.css";

// Make sure these components are default exports in their files
import Assets from "../components/Assets";
import SLA from "../components/SLA";
import EscalationMatrix from "../components/EscalationMatrix";
import Token from "../components/Token"; // You can rename this file to Tokens.jsx if you prefer

const OperationRunbooks = () => {
  const [activeTab, setActiveTab] = useState("Assets");

  const renderTabContent = () => {
    switch (activeTab) {
      case "Assets":
        return <Assets />;
      case "SLA":
        return <SLA />;
      case "EscalationMatrix":
        return <EscalationMatrix />;
      case "Tokens":
        return <Token />;
      default:
        return null;
    }
  };

  return (
    <div className="runbook-container">

      <div className="tabs">
        {["Assets", "SLA", "EscalationMatrix", "Tokens"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tab-content">{renderTabContent()}</div>
    </div>
  );
};

export default OperationRunbooks;

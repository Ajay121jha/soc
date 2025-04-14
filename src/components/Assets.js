import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Assets.css";

const Assets = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/customers")
      .then((res) => setCustomers(res.data))
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch customers.");
      });
  }, []);

  const handleSubmit = async () => {
    if (!selectedCustomer || !issueDescription) {
      setError("Please select a customer and enter issue description.");
      return;
    }

    try {
      const res = await axios.post("http://192.168.1.47:5000/api/tokens", {
        customer_id: selectedCustomer,
        issue_description: issueDescription,
      });
      setTokenInfo(res.data);
      setIssueDescription("");
      setSelectedCustomer("");
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to create token.");
    }
  };

  return (
    <div className="assets-container">
      <h2>Raise Issue for Customer</h2>

      <div className="form-group">
        <label>Select Customer:</label>
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
        >
          <option value="">-- Select --</option>
          {customers.map((cust) => (
            <option key={cust.id} value={cust.id}>
              {cust.name} ({cust.email})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Issue Description:</label>
        <textarea
          value={issueDescription}
          onChange={(e) => setIssueDescription(e.target.value)}
          rows={4}
        />
      </div>

      <button className="submit-btn" onClick={handleSubmit}>
        Generate Token
      </button>

      {error && <div className="error-msg">{error}</div>}

      {tokenInfo && (
        <div className="token-details">
          <h3>Token Created!</h3>
          <p><strong>Token:</strong> {tokenInfo.token}</p>
          <p><strong>Assigned Engineer:</strong> {tokenInfo.assigned_engineer}</p>
          <p><strong>Response Due:</strong> {tokenInfo.response_due}</p>
          <p><strong>Resolution Due:</strong> {tokenInfo.resolution_due}</p>
        </div>
      )}
    </div>
  );
};

export default Assets;

import React, { useEffect, useState } from "react";
import "../styles/OperationRunbook.css";

export default function OperationRunbook() {
  const [clients, setClients] = useState([]);
  const [originalClients, setOriginalClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [assetData, setAssetData] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [filters, setFilters] = useState({ assetType: "", mode: "" });
  const [escalationData, setEscalationData] = useState([]);
  const [activeTab, setActiveTab] = useState("Assets");

  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_name: "", location: "", ip_address: "",
    mode: "", asset_type: "", asset_owner: "", remarks: ""
  });
  const [newEscalation, setNewEscalation] = useState({
    level: "", contact_name: "", contact_email: "",
    contact_number: "", sla_response_hours: "", sla_resolution_hours: ""
  });

  const isAdmin = localStorage.getItem("isAdmin") === "true";

  useEffect(() => {
    fetch("http://localhost:5000/api/clients")
      .then(res => res.json())
      .then(data => {
        const formatted = data.map(([id, name]) => ({ id, name }));
        setClients(formatted);
        setOriginalClients(formatted);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchAssetsAndEscalation(selectedClient);
    }
  }, [selectedClient]);

  const fetchAssetsAndEscalation = (clientId) => {
    fetch(`http://localhost:5000/api/assets?client=${clientId}`)
      .then(res => res.json())
      .then(data => {
        setAssetData(data);
        setFilteredAssets(data);
      })
      .catch(error => {
        console.error("Error fetching assets:", error);
        setAssetData([]);
        setFilteredAssets([]);
      });

    fetch(`http://localhost:5000/api/escalation-matrix?client=${clientId}`)
      .then(res => res.json())
      .then(data => {
        const formattedEscalations = data.map(e => ({
          id: e[0], client_id: e[1], level: e[2],
          contact_name: e[3], contact_email: e[4],
          contact_number: e[5], sla_response_hours: e[6],
          sla_resolution_hours: e[7],
        }));
        setEscalationData(formattedEscalations);
      });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const updatedFilters = { ...filters, [name]: value };
    setFilters(updatedFilters);

    const filtered = assetData.filter(asset =>
      (!updatedFilters.assetType || asset.asset_type === updatedFilters.assetType) &&
      (!updatedFilters.mode || asset.mode === updatedFilters.mode)
    );
    setFilteredAssets(filtered);
  };

  const handleSearchChange = (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = originalClients.filter(c => c.name.toLowerCase().includes(search));
    setClients(filtered);
  };

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    const res = await fetch("http://localhost:5000/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName }),
    });
    if (res.ok) {
      const added = await res.json();
      const newEntry = { id: added.id, name: added.name };
      setClients(prev => [...prev, newEntry]);
      setOriginalClients(prev => [...prev, newEntry]);
      setNewClientName("");
      setIsAddClientModalOpen(false);
    }
  };

  const handleAddAsset = async () => {
    const res = await fetch("http://localhost:5000/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: selectedClient, ...newAsset }),
    });
    if (res.ok) {
      const tempId = Date.now();
      const added = { id: tempId, client_id: selectedClient, ...newAsset };
      setAssetData(prev => [...prev, added]);
      setFilteredAssets(prev => [...prev, added]);
      setNewAsset({ asset_name: "", location: "", ip_address: "", mode: "", asset_type: "", asset_owner: "", remarks: "" });
      setIsAddEntryModalOpen(false);
      fetchAssetsAndEscalation(selectedClient);
    } else {
      console.error("Error adding asset");
    }
  };

  const handleAddEscalation = async () => {
    const res = await fetch("http://localhost:5000/api/escalation-matrix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: selectedClient, ...newEscalation }),
    });
    if (res.ok) {
      fetchAssetsAndEscalation(selectedClient);
      setNewEscalation({ level: "", contact_name: "", contact_email: "", contact_number: "", sla_response_hours: "", sla_resolution_hours: "" });
      setIsAddEntryModalOpen(false);
    }
  };

  return (
    <div className="operation-runbook-container">
      <div className="sidebar">
        <input
          type="text"
          className="search-box"
          placeholder="Search clients..."
          onChange={handleSearchChange}
        />
        {isAdmin && (
          <button onClick={() => setIsAddClientModalOpen(true)} className="add-client-btn">
            Add Client
          </button>
        )}
        <ul className="client-list">
          {clients.map(client => (
            <li key={client.id} onClick={() => { setSelectedClient(client.id); setSelectedClientName(client.name); }}>
              🟣 {client.name}
            </li>
          ))}
        </ul>
      </div>
      <div className="client-details">
        {selectedClient && (
          <>
            <p className="client-text">{selectedClientName}</p>
            <div className="tab-buttons">
              <button onClick={() => setActiveTab("Assets")} className={activeTab === "Assets" ? "active" : ""}>Assets</button>
              <button onClick={() => setActiveTab("Escalation Matrix")} className={activeTab === "Escalation Matrix" ? "active" : ""}>Escalation Matrix</button>
              {isAdmin && (
                <button onClick={() => setIsAddEntryModalOpen(true)} className="add-entry-btn">
                  Add Entry
                </button>
              )}
            </div>
            {activeTab === "Assets" && (
              <>
                <div className="filters">
                  <select name="assetType" value={filters.assetType} onChange={handleFilterChange}>
                    <option value="">All Asset Types</option>
                    <option value="Linux">Linux</option>
                    <option value="Window">Window</option>
                    <option value="Network Appliance">Network Appliance</option>
                  </select>
                  <select name="mode" value={filters.mode} onChange={handleFilterChange}>
                    <option value="">All Modes</option>
                    <option value="RDP">RDP</option>
                    <option value="SSH">SSH</option>
                  </select>
                </div>
                <table className="asset-table">
                  <thead>
                    <tr>
                      <th>Asset Name</th>
                      <th>Location</th>
                      <th>IP Address</th>
                      <th>Mode</th>
                      <th>Type</th>
                      <th>Owner</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((asset, idx) => (
                      <tr key={idx}>
                        <td>{asset.asset_name}</td>
                        <td>{asset.location}</td>
                        <td>{asset.ip_address}</td>
                        <td>{asset.mode}</td>
                        <td>{asset.asset_type}</td>
                        <td>{asset.asset_owner}</td>
                        <td>{asset.remarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {activeTab === "Escalation Matrix" && (
              <table className="asset-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Contact Name</th>
                    <th>Email Address</th>
                    <th>Phone No.</th>
                    <th>SLA Response Time</th>
                    <th>SLA Resolution Time</th>
                  </tr>
                </thead>
                <tbody>
                  {escalationData.map((row, i) => (
                    <tr key={i}>
                      <td>{row.level}</td>
                      <td>{row.contact_name}</td>
                      <td>{row.contact_email}</td>
                      <td>{row.contact_number}</td>
                      <td>{row.sla_response_hours}</td>
                      <td>{row.sla_resolution_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {isAddClientModalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Add New Client</h3>
            <input
              type="text"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              placeholder="Client Name"
            />
            <div className="modal-buttons">
              <button onClick={handleAddClient}>Save</button>
              <button onClick={() => setIsAddClientModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isAddEntryModalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            {activeTab === "Assets" ? (
              <>
                <h3>Add New Asset</h3>
                <input value={newAsset.asset_name} onChange={e => setNewAsset(prev => ({ ...prev, asset_name: e.target.value }))} placeholder="Asset Name" />
                <input value={newAsset.location} onChange={e => setNewAsset(prev => ({ ...prev, location: e.target.value }))} placeholder="Location" />
                <input value={newAsset.ip_address} onChange={e => setNewAsset(prev => ({ ...prev, ip_address: e.target.value }))} placeholder="IP Address" />
                <input value={newAsset.mode} onChange={e => setNewAsset(prev => ({ ...prev, mode: e.target.value }))} placeholder="Mode" />
                <input value={newAsset.asset_type} onChange={e => setNewAsset(prev => ({ ...prev, asset_type: e.target.value }))} placeholder="Asset Type" />
                <input value={newAsset.asset_owner} onChange={e => setNewAsset(prev => ({ ...prev, asset_owner: e.target.value }))} placeholder="Asset Owner" />
                <input value={newAsset.remarks} onChange={e => setNewAsset(prev => ({ ...prev, remarks: e.target.value }))} placeholder="Remarks" />
                <div className="modal-buttons">
                  <button onClick={handleAddAsset}>Save</button>
                  <button onClick={() => setIsAddEntryModalOpen(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3>Add Escalation Contact</h3>
                <input value={newEscalation.level} onChange={e => setNewEscalation(prev => ({ ...prev, level: e.target.value }))} placeholder="Level" />
                <input value={newEscalation.contact_name} onChange={e => setNewEscalation(prev => ({ ...prev, contact_name: e.target.value }))} placeholder="Contact Name" />
                <input value={newEscalation.contact_email} onChange={e => setNewEscalation(prev => ({ ...prev, contact_email: e.target.value }))} placeholder="Contact Email" />
                <input value={newEscalation.contact_number} onChange={e => setNewEscalation(prev => ({ ...prev, contact_number: e.target.value }))} placeholder="Contact Number" />
                <input value={newEscalation.sla_response_hours} onChange={e => setNewEscalation(prev => ({ ...prev, sla_response_hours: e.target.value }))} placeholder="SLA Response Hours" />
                <input value={newEscalation.sla_resolution_hours} onChange={e => setNewEscalation(prev => ({ ...prev, sla_resolution_hours: e.target.value }))} placeholder="SLA Resolution Hours" />
                <div className="modal-buttons">
                  <button onClick={handleAddEscalation}>Save</button>
                  <button onClick={() => setIsAddEntryModalOpen(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

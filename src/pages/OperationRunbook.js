import React, { useEffect, useState } from "react";
import "../styles/OperationRunbook.css";
import {
  Briefcase,
  ClipboardList,
  GitFork,
  Key,
  HardDrive,
  Search,
  Upload,
  Download,
  Filter,
} from "lucide-react"; // Importing icons from lucide-react

export default function OperationRunbook() {
  const [isAddEscalationModalOpen, setIsAddEscalationModalOpen] = useState(false);
  const [clientPDF, setClientPDF] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [activeTab, setActiveTab] = useState("tab1");
  const [originalClients, setOriginalClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [assetData, setAssetData] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [filters, setFilters] = useState({ assetType: "", mode: "" });
  const [escalationData, setEscalationData] = useState([]);
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_name: "", location: "", ip_address: "",
    mode: "", asset_type: "", asset_owner: "", remarks: ""
  });
  const [slaData, setSlaData] = useState([]);
  const [passwords, setPasswords] = useState([]);
  const [newEscalation, setNewEscalation] = useState({
    level: "",
    client_name: "",
    client_email: "",
    client_contact: "",
    client_designation: "",
    gtb_name: "",
    gtb_email: "",
    gtb_contact: "",
    gtb_designation: ""
  });

  // State for search and filter within tabs
  const [assetSearchTerm, setAssetSearchTerm] = useState("");
  const [slaSearchTerm, setSlaSearchTerm] = useState("");


  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedClient) return;

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("clientId", selectedClient);

    const res = await fetch("http://localhost:5000/api/upload-pdf", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const { fileName } = await res.json();
      setClientPDF(fileName);
      // Close the upload modal after successful upload
      setShowUploadModal(false);
    } else {
      console.error("PDF upload failed");
      // Optionally, show an error message to the user
      alert("Failed to upload PDF.");
    }
  };

  const handleDeletePDF = async () => {
    if (!selectedClient) return;

    const res = await fetch(`http://localhost:5000/api/delete-client-pdf?clientId=${selectedClient}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setClientPDF(null);
      // Close the upload modal if it's open after deletion
      setShowUploadModal(false);
      alert("PDF deleted successfully."); // Replaced alert
    } else {
      alert("Failed to delete PDF."); // Replaced alert
    }
  };

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

      fetch(`http://localhost:5000/api/get-client-pdf?clientId=${selectedClient}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.fileName) {
            setClientPDF(data.fileName);
          } else {
            setClientPDF(null);
          }
        })
        .catch(console.error);

      fetch(`http://localhost:5000/api/sla?client=${selectedClient}`)
        .then((res) => res.json())
        .then((data) => setSlaData(data))
        .catch((err) => console.error("SLA Fetch Error:", err));

      fetch(`http://localhost:5000/api/passwords?client=${selectedClient}`)
        .then((res) => res.json())
        .then((data) => setPasswords(data))
        .catch((err) => console.error("Password Fetch Error:", err));
    }
  }, [selectedClient]);

  const fetchAssetsAndEscalation = (clientId) => {
    fetch(`http://localhost:5000/api/assets?client=${clientId}`)
      .then(res => res.json())
      .then(data => {
        const safeData = Array.isArray(data) ? data : []
        setAssetData(safeData);
        setFilteredAssets(safeData);
      })
      .catch(error => {
        console.error("Error fetching assets:", error);
        setAssetData([]);
        setFilteredAssets([]);
      });

    fetch(`http://localhost:5000/api/escalation-matrix?client=${clientId}`)
      .then(res => res.json())
      .then(data => {
        setEscalationData(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error("Escalation fetch error:", err));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    const updatedFilters = { ...filters, [name]: value };
    setFilters(updatedFilters);

    // Apply filters and search term
    const filtered = assetData.filter(asset =>
      (!updatedFilters.assetType || asset.asset_type === updatedFilters.assetType) &&
      (!updatedFilters.mode || asset.mode === updatedFilters.mode) &&
      (asset.asset_name.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        asset.location.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        asset.ip_address.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
        asset.asset_type.toLowerCase().includes(assetSearchTerm.toLowerCase()))
    );
    setFilteredAssets(filtered);
  };

  const handleAssetSearchChange = (e) => {
    const searchTerm = e.target.value;
    setAssetSearchTerm(searchTerm);
    // Re-apply filters with the new search term
    const filtered = assetData.filter(asset =>
      (!filters.assetType || asset.asset_type === filters.assetType) &&
      (!filters.mode || asset.mode === filters.mode) &&
      (asset.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.asset_type.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredAssets(filtered);
  };

  const handleSlaSearchChange = (e) => {
    const searchTerm = e.target.value;
    setSlaSearchTerm(searchTerm);
    // Filter SLA data based on search term
    const filteredSla = slaData.filter(sla =>
      sla.priority.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sla.response_time.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sla.resolution_time.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSlaData(filteredSla); // This will filter the displayed SLA data
  };


  const handleClientSearchChange = (e) => {
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
      // Fetch updated assets after adding a new one
      fetchAssetsAndEscalation(selectedClient);
      setNewAsset({ asset_name: "", location: "", ip_address: "", mode: "", asset_type: "", asset_owner: "", remarks: "" });
      setIsAddEntryModalOpen(false);
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
      // Fetch updated escalation matrix after adding a new entry
      fetchAssetsAndEscalation(selectedClient);
      setNewEscalation({
        level: "",
        client_name: "",
        client_email: "",
        client_contact: "",
        client_designation: "",
        gtb_name: "",
        gtb_email: "",
        gtb_contact: "",
        gtb_designation: ""
      });
      setIsAddEscalationModalOpen(false);
    } else {
      console.error("Error adding escalation entry");
    }
  };

  // Placeholder for Import/Export functionality
  const handleImport = (tabName) => {
    console.log(`Import functionality for ${tabName}`);
    // Implement actual import logic here
    alert(`Importing data for ${tabName}. (Functionality not fully implemented)`);
  };

  const handleExport = (tabName) => {
    console.log(`Export functionality for ${tabName}`);
    // Implement actual export logic here
    alert(`Exporting data for ${tabName}. (Functionality not fully implemented)`);
  };


  return (
    <div className="operation-runbook-container">
      {/* Sidebar for Client List */}
      <div className="sidebar modern-sidebar">
        <input
          type="text"
          className="search-box"
          placeholder="Search clients..."
          onChange={handleClientSearchChange}
        />
        {isAdmin && (
          <button
            onClick={() => setIsAddClientModalOpen(true)}
            className="add-client-btn"
          >
            Add Client
          </button>
        )}
        <ul className="client-list">
          {clients.map((client) => (
            <li
              key={client.id}
              onClick={() => {
                setSelectedClient(client.id);
                setSelectedClientName(client.name);
              }}
              className={selectedClient === client.id ? "active-client" : ""}
            >
              🟣 {client.name}
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content Area for Client Details */}
      {selectedClient && (
        <div className="client-details">
          {/* Client Name Header */}
          <div className="client-header">
            <h2 className="client-name-display">{selectedClientName}</h2>
            <p className="client-description">Client operational details and configurations</p>
          </div>

          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === "tab1" ? "active" : ""}`}
              onClick={() => setActiveTab("tab1")}
            >
              <Briefcase size={20} />
              <span>Scope of Work</span>
            </button>
            <button
              className={`tab-button ${activeTab === "tab2" ? "active" : ""}`}
              onClick={() => setActiveTab("tab2")}
            >
              <ClipboardList size={20} />
              <span>SLA</span>
            </button>
            <button
              className={`tab-button ${activeTab === "tab3" ? "active" : ""}`}
              onClick={() => setActiveTab("tab3")}
            >
              <GitFork size={20} />
              <span>Escalation Matrix</span>
            </button>
            <button
              className={`tab-button ${activeTab === "tab4" ? "active" : ""}`}
              onClick={() => setActiveTab("tab4")}
            >
              <Key size={20} />
              <span>Password List</span>
            </button>
            <button
              className={`tab-button ${activeTab === "tab5" ? "active" : ""}`}
              onClick={() => setActiveTab("tab5")}
            >
              <HardDrive size={20} />
              <span>Asset Inventory</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content-area">
            {/* Scope of Work Tab */}
            {activeTab === "tab1" && (
              <div className="sow modern-tab-content">
                <div className="tab-controls">
                  <h3 className="tab-title">Scope of Work</h3>
                  {isAdmin && (
                    <div className="action-buttons">
                      <button className="action-button" onClick={() => setShowUploadModal(true)} style={{ marginRight: "10px" }}>
                        <Upload size={16} /> Upload SOW PDF
                      </button>
                      <button className="action-button delete-button" onClick={handleDeletePDF}>
                        <Download size={16} /> Delete SOW PDF
                      </button>
                    </div>
                  )}
                </div>

                {clientPDF ? (
                  <iframe
                    src={`http://localhost:5000/pdfs/client_${selectedClient}.pdf#toolbar=0`}
                    width="100%"
                    height="600px"
                    className="pdf-viewer"
                    title="PDF Preview"
                  />
                ) : (
                  <p className="no-data-message">No PDF uploaded for this client.</p>
                )}
              </div>
            )}

            {/* Service Level Agreement Tab */}
            {activeTab === "tab2" && (
              <div className="sla modern-tab-content">
                <div className="tab-controls">
                  <h3 className="tab-title">Service Level Agreement</h3>
                  <div className="controls-right">
                    <div className="search-filter-group">
                      <div className="search-input-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                          type="text"
                          placeholder="Search..."
                          className="search-input"
                          value={slaSearchTerm}
                          onChange={handleSlaSearchChange}
                        />
                      </div>
                      <select className="filter-dropdown" onChange={(e) => console.log(e.target.value)}>
                        <option value="">All Status</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <button className="action-button" onClick={() => handleImport("SLA")}>
                      <Upload size={16} /> Upload Excel
                    </button>
                    <button className="action-button" onClick={() => handleExport("SLA")}>
                      <Download size={16} /> Export
                    </button>
                  </div>
                </div>

                <table className="sla_table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Priority</th>
                      <th>Response Time</th>
                      <th>Resolution Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slaData.length === 0 ? (
                      <tr><td colSpan="4" className="no-data-message">No SLA policies found</td></tr>
                    ) : (
                      slaData.map((sla, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>
                            <span className={`priority-tag ${sla.priority.toLowerCase()}`}>
                              {sla.priority}
                            </span>
                          </td>
                          <td>{sla.response_time}</td>
                          <td>{sla.resolution_time}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Escalation Matrix Tab */}
            {activeTab === "tab3" && (
              <div className="escalation_matrix modern-tab-content">
                <div className="tab-controls">
                  <h3 className="tab-title">Escalation Matrix</h3>
                  {isAdmin && (
                    <button
                      onClick={() => setIsAddEscalationModalOpen(true)}
                      className="action-button"
                    >
                      Add Escalation Entry
                    </button>
                  )}
                </div>



                <div className="escalation-section">
                  <div className="escalation-table-container">
                    {
                      <table className="escalation_matrix_table">
                        <thead>
                          <tr>
                            <th rowSpan="2">Level</th>
                            <th colSpan="4">Client Side</th>
                            <th colSpan="4">GTBharat Side</th>
                          </tr>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Contact</th>
                            <th>Designation</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Contact</th>
                            <th>Designation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {escalationData.length === 0 ? (
                            <tr><td colSpan="9" className="no-data-message">No escalation entries found</td></tr>
                          ) : (
                            escalationData.map((entry, index) => (
                              <tr key={index}>
                                <td>{entry.level}</td>
                                <td>{entry.client_name}</td>
                                <td>{entry.client_email}</td>
                                <td>{entry.client_contact}</td>
                                <td>{entry.client_designation}</td>
                                <td>{entry.gtb_name}</td>
                                <td>{entry.gtb_email}</td>
                                <td>{entry.gtb_contact}</td>
                                <td>{entry.gtb_designation}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    }
                  </div>
                </div>




              </div>
            )}

            {/* Passwords List Tab */}
            {activeTab === "tab4" && (
              <div className="passwords_list modern-tab-content">
                <div className="tab-controls">
                  <h3 className="tab-title">Passwords List</h3>
                  {
                    <select
                      name="mode"
                      value={filters.mode}
                      onChange={handleFilterChange}
                      className="filter-dropdown"
                    >
                      <option value="">All Modes</option>
                      <option value="RDP">RDP</option>
                      <option value="SSH">SSH</option>
                    </select>
                  }

                </div>
                <table className="passwords_list_table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Asset ID</th>
                      <th>Mode</th>
                      <th>Username</th>
                      <th>Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passwords.length === 0 ? (
                      <tr><td colSpan="5" className="no-data-message">No passwords found</td></tr>
                    ) : (
                      passwords.map((pw, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{pw.asset_name}</td>
                          <td>{pw.mode}</td>
                          <td>{pw.username}</td>
                          <td>{pw.password}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Assets Inventory Tab */}
            {activeTab === "tab5" && (
              <div className="assets_inventory modern-tab-content">
                <div className="tab-controls">
                  <h3 className="tab-title">Assets Inventory</h3>
                  <div className="controls-right">
                    <div className="search-filter-group">
                      <div className="search-input-wrapper">
                        <Search size={18} className="search-icon" />
                        <input
                          type="text"
                          placeholder="Search assets..."
                          className="search-input"
                          value={assetSearchTerm}
                          onChange={handleAssetSearchChange}
                        />
                      </div>
                      <select
                        name="assetType"
                        value={filters.assetType}
                        onChange={handleFilterChange}
                        className="filter-dropdown"
                      >
                        <option value="">All Asset Types</option>
                        <option value="Server">Server</option>
                        <option value="Workstation">Workstation</option>
                        <option value="Network Device">Network Device</option>
                        {/* Add more asset types as needed */}
                      </select>
                      <select
                        name="mode"
                        value={filters.mode}
                        onChange={handleFilterChange}
                        className="filter-dropdown"
                      >
                        <option value="">All Modes</option>
                        <option value="RDP">RDP</option>
                        <option value="SSH">SSH</option>
                      </select>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => setIsAddEntryModalOpen(true)}
                        className="action-button"
                      >
                        Add Asset
                      </button>
                    )}
                    <button className="action-button" onClick={() => handleImport("Assets")}>
                      <Upload size={16} /> Import
                    </button>
                    <button className="action-button" onClick={() => handleExport("Assets")}>
                      <Download size={16} /> Export
                    </button>
                  </div>
                </div>

                <table className="assets-inventory-table">
                  <thead>
                    <tr>
                      <th>Asset Name</th>
                      <th>Location</th>
                      <th>IP Address</th>
                      <th>Mode</th>
                      <th>Asset Type</th>
                      <th>Asset Owner</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr><td colSpan="7" className="no-data-message">No assets found matching criteria</td></tr>
                    ) : (
                      filteredAssets.map((asset, index) => (
                        <tr key={index}>
                          <td>{asset.asset_name}</td>
                          <td>{asset.location}</td>
                          <td>{asset.ip_address}</td>
                          <td>{asset.mode}</td>
                          <td>{asset.asset_type}</td>
                          <td>{asset.asset_owner}</td>
                          <td>{asset.remarks}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals (unchanged, but ensure styling is consistent) */}
      {isAddClientModalOpen && (
        <div className="add-client-modal">
          <div className="add-client-modal-content">
            <h3>Add New Client</h3>
            <input
              type="text"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="Enter client name"
            />
            <div className="add-client-modal-actions">
              <button onClick={handleAddClient}>Submit</button>
              <button onClick={() => setIsAddClientModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isAddEscalationModalOpen && (
        <div className="add-escalation-modal">
          <div className="add-escalation-modal-content">
            <h3>Add Escalation Entry</h3>
            <input type="text" placeholder="Level" value={newEscalation.level} onChange={(e) => setNewEscalation({ ...newEscalation, level: e.target.value })} />
            <div className="escalation_modal_div">
              <div className="client_side">
                <h4>Client Side</h4>
                <input type="text" placeholder="Name" value={newEscalation.client_name} onChange={(e) => setNewEscalation({ ...newEscalation, client_name: e.target.value })} />
                <input type="email" placeholder="Email" value={newEscalation.client_email} onChange={(e) => setNewEscalation({ ...newEscalation, client_email: e.target.value })} />
                <input type="text" placeholder="Contact" value={newEscalation.client_contact} onChange={(e) => setNewEscalation({ ...newEscalation, client_contact: e.target.value })} />
                <input type="text" placeholder="Designation" value={newEscalation.client_designation} onChange={(e) => setNewEscalation({ ...newEscalation, client_designation: e.target.value })} />
              </div>
              <div className="gt_side">
                <h4>GTBharat Side</h4>
                <input type="text" placeholder="Name" value={newEscalation.gtb_name} onChange={(e) => setNewEscalation({ ...newEscalation, gtb_name: e.target.value })} />
                <input type="email" placeholder="Email" value={newEscalation.gtb_email} onChange={(e) => setNewEscalation({ ...newEscalation, gtb_email: e.target.value })} />
                <input type="text" placeholder="Contact" value={newEscalation.gtb_contact} onChange={(e) => setNewEscalation({ ...newEscalation, gtb_contact: e.target.value })} />
                <input type="text" placeholder="Designation" value={newEscalation.gtb_designation} onChange={(e) => setNewEscalation({ ...newEscalation, gtb_designation: e.target.value })} />
              </div>
            </div>
            <div className="add-escalation-modal-actions">
              <button onClick={handleAddEscalation}>Submit</button>
              <button onClick={() => setIsAddEscalationModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isAddEntryModalOpen && (
        <div className="add-asset-modal">
          <div className="add-asset-modal-content">
            <h3>Add New Asset</h3>
            <input type="text" placeholder="Asset Name" value={newAsset.asset_name} onChange={(e) => setNewAsset({ ...newAsset, asset_name: e.target.value })} />
            <input type="text" placeholder="Location" value={newAsset.location} onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })} />
            <input type="text" placeholder="IP Address" value={newAsset.ip_address} onChange={(e) => setNewAsset({ ...newAsset, ip_address: e.target.value })} />
            <select
              value={newAsset.mode}
              onChange={(e) => setNewAsset({ ...newAsset, mode: e.target.value })}
            >
              <option value="">Select Mode</option>
              <option value="RDP">RDP</option>
              <option value="SSH">SSH</option>
            </select>
            <input type="text" placeholder="Asset Type" value={newAsset.asset_type} onChange={(e) => setNewAsset({ ...newAsset, asset_type: e.target.value })} />
            <input type="text" placeholder="Asset Owner" value={newAsset.asset_owner} onChange={(e) => setNewAsset({ ...newAsset, asset_owner: e.target.value })} />
            <input type="text" placeholder="Remarks" value={newAsset.remarks} onChange={(e) => setNewAsset({ ...newAsset, remarks: e.target.value })} />
            <div className="add-asset-modal-actions">
              <button onClick={handleAddAsset}>Submit</button>
              <button onClick={() => setIsAddEntryModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="upload-sow-modal">
          <div className="modal-content">
            <h3>Upload SOW PDF</h3>
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePDFUpload}
            />
            <button onClick={() => setShowUploadModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

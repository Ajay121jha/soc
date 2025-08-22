import React, { useEffect, useState, useCallback } from 'react';
import { Briefcase, Eye, Search, Send, Layers, Settings, X, PlusCircle, Mail, Tags, Edit3, Delete, Users, FilePlus } from 'lucide-react';
import "../styles/Advisory.css";
import FormattedAdvisoryView from './FormattedAdvisoryView';

const stripHtml = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img').forEach(img => img.remove());
  return doc.body.textContent || "";
};

const initialAdvisoryState = {
  techStackId: '',
  version: '',
  updateType: '',
  description: '',
  vulnerability_details: '',
  technical_analysis: '',
  impact_details: '',
  mitigation_strategies: '',
  detection_response: '',
  recommendations: '',
};

export default function AdvisorySystem() {
  // --- Core Data State ---
  const [clients, setClients] = useState([]);
  const [techStacks, setTechStacks] = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- UI and Filtering State ---
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [viewingAdvisory, setViewingAdvisory] = useState(null);
  const [activeTab, setActiveTab] = useState('clients'); // State for sidebar tabs

  // --- Advisory Creation Form State ---
  const [newAdvisory, setNewAdvisory] = useState(initialAdvisoryState);

  // --- RSS Feed State ---
  const [rssItems, setRssItems] = useState([]);
  const [isRssLoading, setIsRssLoading] = useState(false);
  const [rssFeeds, setRssFeeds] = useState([]);
  const [newRssUrl, setNewRssUrl] = useState('');
  const [selectedTechStackId, setSelectedTechStackId] = useState('');

  // --- Modal States ---
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configuringClient, setConfiguringClient] = useState(null);
  const [clientTechDetails, setClientTechDetails] = useState([]);
  const [newTechStackId, setNewTechStackId] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [showTechModal, setShowTechModal] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [feedsToDelete, setFeedsToDelete] = useState(new Set());
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdvisory, setEditingAdvisory] = useState(null);
  const [editFormState, setEditFormState] = useState(null);

  const fetchAdvisories = useCallback(async () => {
    if (selectedClientId) {
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/advisories`);
        if (!response.ok) throw new Error('Failed to fetch advisories');
        const data = await response.json();
        setAdvisories(data);
      } catch (error) {
        console.error("Error fetching advisories:", error);
        setAdvisories([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setAdvisories([]);
    }
  }, [selectedClientId]);

  const fetchTechStacks = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/tech-stacks');
      setTechStacks(await res.json());
    } catch (error) {
      console.error("Error fetching tech stacks:", error);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const res = await fetch('http://localhost:5000/api/clients');
      const data = await res.json();
      setClients(data.map(c => ({ id: c[0], name: c[1] })));
      await fetchTechStacks();
      setIsLoading(false);
    };
    fetchInitialData();
  }, [fetchTechStacks]);

  useEffect(() => {
    if (selectedClientId) {
      setIsLoading(true);
      const fetchAllData = async () => {
        await fetchAdvisories();
        setIsRssLoading(true);
        try {
          const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/feed-items`);
          const rssData = await response.json();

          console.log("RSS items fetched:", rssData);

          setRssItems(Array.isArray(rssData) ? rssData.map(item => ({ ...item, summary: stripHtml(item.summary) })) : []);
          if (rssData.length > 0) {
            await fetchAdvisories();
          }
        } catch (error) {
          console.error("Error fetching RSS items:", error);
          setRssItems([]);
        } finally {
          setIsRssLoading(false);
          setIsLoading(false);
        }
      };
      fetchAllData();
    } else {
      setAdvisories([]);
      setRssItems([]);
    }
  }, [selectedClientId, fetchAdvisories]);



  const sendAdvisoryEmail = async (advisory) => {
    try {
      const response = await fetch('http://localhost:5000/api/dispatch-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: advisory.update_type + ' for ' + advisory.service_or_os,
          content: advisory.description + '\n\n' + advisory.technical_analysis,
          clientTechMapId: advisory.client_tech_map_id // make sure this ID is available
        })
      });

      const result = await response.json();
      alert(result.message || result.error);
    } catch (error) {
      alert("Failed to send advisory: " + error.message);
    }
  };


  const openClientConfigModal = useCallback(async (client) => {
    setConfiguringClient(client);
    setShowConfigModal(true);
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${client.id}/tech`);
      const data = await response.json();
      setClientTechDetails(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch client tech details", error);
      setClientTechDetails([]);
    }
  }, []);

  const handleOpenEditModal = (advisory, e) => {
    e.stopPropagation();
    setEditingAdvisory(advisory);
    setEditFormState({ ...advisory });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingAdvisory(null);
    setEditFormState(null);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateAdvisory = async (newStatus) => {
    if (!editingAdvisory) return;
    const payload = { ...editFormState, status: newStatus };
    try {
      const response = await fetch(`http://localhost:5000/api/advisories/${editingAdvisory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to update advisory`);
      alert(`Advisory successfully ${newStatus === 'Sent' ? 'dispatched' : 'saved'}.`);
      await sendAdvisoryEmail(editingAdvisory);

      handleCloseEditModal();
      fetchAdvisories();
    } catch (error) {
      console.error("Error updating advisory:", error);
      alert(error.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAdvisory(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitAdvisory = async (e) => {
    e.preventDefault();
    const { techStackId, version, updateType, description } = newAdvisory;
    if (!techStackId || !version || !updateType || !description) {
      alert("Please fill out the basic advisory fields (Tech, Version, Type, Summary).");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/advisories/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdvisory),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to submit bulk advisory');
      fetchAdvisories();
      alert(result.message);
      setNewAdvisory(initialAdvisoryState);
    } catch (error) {
      console.error("Error submitting bulk advisory:", error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClientTechVersion = async () => {
    if (!newTechStackId || !newVersion.trim()) {
      alert('Please select a tech stack and enter a version.');
      return;
    }
    try {
      await fetch(`http://localhost:5000/api/clients/${configuringClient.id}/tech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tech_stack_id: newTechStackId, version: newVersion }),
      });
      setNewVersion('');
      setNewTechStackId('');
      openClientConfigModal(configuringClient);
    } catch (error) {
      console.error("Failed to add tech version:", error);
    }
  };

  const handleAddContact = async (clientTechMapId) => {
    if (!newContactEmail.trim() || !newContactEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    try {
      await fetch(`http://localhost:5000/api/client-tech/${clientTechMapId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newContactEmail }),
      });
      setNewContactEmail('');
      openClientConfigModal(configuringClient);
    } catch (error) {
      console.error("Failed to add contact:", error);
    }
  };

  const handleAddNewTechStack = async (e) => {
    e.preventDefault();
    if (!newTechName.trim()) {
      alert('Please enter a name for the new tech stack.');
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/tech-stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTechName }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to add tech stack');
      }
      setNewTechName('');
      fetchTechStacks();
      alert(`Successfully added '${result.name}'`);
    } catch (error) {
      console.error("Error adding new tech stack:", error);
      alert(error.message);
    }
  };

  const fetchRssFeeds = async (techStackId) => {
    if (!techStackId) {
      setRssFeeds([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/rss-feeds?techStackId=${techStackId}`);
      const data = await res.json();
      setRssFeeds(data);
    } catch (error) {
      console.error("Error fetching RSS feeds:", error);
    }
  };

  const handleAddRssFeed = async () => {
    if (!selectedTechStackId || !newRssUrl.trim()) {
      alert("Please select a tech stack and enter a valid RSS URL.");
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tech_stack_id: selectedTechStackId, url: newRssUrl })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to add RSS feed");
      setNewRssUrl('');
      fetchRssFeeds(selectedTechStackId);
      alert("RSS feed added successfully!");
    } catch (error) {
      console.error("Error adding RSS feed:", error);
      alert(error.message);
    }
  };

  const handleFeedSelection = (e, url) => {
    const newSelection = new Set(feedsToDelete);
    if (e.target.checked) {
      newSelection.add(url);
    } else {
      newSelection.delete(url);
    }
    setFeedsToDelete(newSelection);
  };

  const handleDeleteRssFeeds = async () => {
    if (feedsToDelete.size === 0 || !selectedTechStackId) {
      alert("No feeds selected or no tech stack specified.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${feedsToDelete.size} feed(s)? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/rss-feeds', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tech_stack_id: selectedTechStackId,
          urls: Array.from(feedsToDelete),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete feeds");
      alert(result.message);
      setIsDeleteMode(false);
      setFeedsToDelete(new Set());
      fetchRssFeeds(selectedTechStackId);
    } catch (error) {
      console.error("Error deleting RSS feeds:", error);
      alert(error.message);
    }
  };

  const handleDeleteClientTech = async (clientTechMapId) => {
    if (!window.confirm("Are you sure you want to delete this tech stack assignment?")) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/client-tech/${clientTechMapId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete tech stack assignment.');
      }
      alert("Tech stack assignment deleted successfully!");
      openClientConfigModal(configuringClient);
    } catch (error) {
      console.error("Failed to delete tech stack:", error);
      alert(error.message);
    }
  };







  const handleDeleteAdvisory = async (advisoryId) => {
    if (!window.confirm("Are you sure you want to delete this advisory?")) return;

    try {
      const response = await fetch(`http://localhost:5000/api/advisories/${advisoryId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete advisory");
      alert("Advisory deleted successfully.");
      fetchAdvisories(); // Refresh the list
    } catch (error) {
      console.error("Error deleting advisory:", error);
      alert(error.message);
    }
  };












  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );
  const selectedClientName = clients.find(c => c.id === Number(selectedClientId))?.name || '';

  return (
    <div className="flex h-screen bg-gray-100 font-inter text-gray-800">
      {/* Left Sidebar */}
      <aside className="w-96 bg-white p-5 shadow-lg flex flex-col">
        <h2 className="text-2xl soc font-bold text-gray-800 mb-4 flex-shrink-0">Advisory System</h2>

        <div className="flex ajay border-b mb-4 flex-shrink-0">
          <button className={`tab-button ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>
            <Users size={16} className="mr-2" /> Clients
          </button>
          <button className={`tab-button ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
            <FilePlus size={16} className="mr-2" /> Create Advisory
          </button>
        </div>
        <div className="relative mb-3">
          {/* <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" /> */}
          <input type="text" placeholder="Search clients..." value={clientSearchTerm} onChange={(e) => setClientSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>

        <div className="flex-grow overflow-y-auto">
          {activeTab === 'clients' && (
            <div className="flex flex-col h-full">
              {/* <h3 className="text-lg font-semibold text-gray-700 mb-2">Clients</h3> */}

              <div className="flex-grow overflow-y-auto border rounded-lg p-2 bg-gray-50">
                {filteredClients.map(client => (
                  <div key={client.id} className={`client-list-item ${selectedClientId === client.id ? 'selected' : ''}`} onClick={() => setSelectedClientId(client.id)}>
                    <span className="client-name">{client.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); openClientConfigModal(client); }} className="client-config-button" title={`Configure ${client.name}`}>
                      <Settings size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowTechModal(true)} className="secondary-button mt-4" title="Manage Tech Stacks">
                <Tags size={16} className="mr-2" /> Manage Tech Stacks
              </button>
            </div>
          )}

          {activeTab === 'create' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-700">Create Manual Advisory</h3>
              </div>
              <form onSubmit={handleSubmitAdvisory} className="space-y-3">
                <select name="techStackId" value={newAdvisory.techStackId} onChange={handleInputChange} required className="form-input">
                  <option value="">-- Select Tech Stack --</option>
                  {techStacks.map(stack => <option key={stack.id} value={stack.id}>{stack.name}</option>)}
                </select>
                <input type="text" name="version" placeholder="Version (e.g., 22H2, 11.x, *)" value={newAdvisory.version} onChange={handleInputChange} required className="form-input" />
                <select name="updateType" value={newAdvisory.updateType} onChange={handleInputChange} required className="form-input">
                  <option value="">-- Select Update Type --</option>
                  <option value="Security Patch">Security Patch</option>
                  <option value="Vulnerability Alert">Vulnerability Alert</option>
                  <option value="Informational">Informational</option>
                </select>


                <label className="form-label">Summary</label>
                <textarea name="description" placeholder="A brief summary of the advisory..." value={newAdvisory.description} onChange={handleInputChange} rows="3" required className="form-input"></textarea>

                <label className="form-label">Vulnerability Details</label>
                <textarea name="vulnerability_details" placeholder="Details about the vulnerability (one per line)..." value={newAdvisory.vulnerability_details} onChange={handleInputChange} rows="3" className="form-input"></textarea>

                <label className="form-label">Technical Analysis</label>
                <textarea name="technical_analysis" placeholder="Technical analysis of the threat..." value={newAdvisory.technical_analysis} onChange={handleInputChange} rows="4" className="form-input"></textarea>

                <label className="form-label">Impact</label>
                <textarea name="impact_details" placeholder="Potential impact (one per line)..." value={newAdvisory.impact_details} onChange={handleInputChange} rows="3" className="form-input"></textarea>

                <label className="form-label">Mitigation Strategies</label>
                <textarea name="mitigation_strategies" placeholder="Mitigation steps (one per line)..." value={newAdvisory.mitigation_strategies} onChange={handleInputChange} rows="3" className="form-input"></textarea>

                <label className="form-label">Detection and Response</label>
                <textarea name="detection_response" placeholder="Detection methods (one per line)..." value={newAdvisory.detection_response} onChange={handleInputChange} rows="3" className="form-input"></textarea>

                <label className="form-label">Recommendations</label>
                <textarea name="recommendations" placeholder="Further recommendations (one per line)..." value={newAdvisory.recommendations} onChange={handleInputChange} rows="3" className="form-input"></textarea>

                <button type="submit" className="submit-button w-full mt-4" disabled={isLoading}><Send size={18} className="inline-block mr-2" /> Dispatch Manually</button>
              </form>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between ajay items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{selectedClientName ? `Advisories for ${selectedClientName}` : "Select a Client"}</h1>
        </div>
        {isLoading && <p>Loading advisories...</p>}
        {!isLoading && advisories.length === 0 && <p className="text-gray-500 italic text-center mt-8">{selectedClientId ? 'No advisories found for this client.' : 'Please select a client to view advisories.'}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {advisories.map((advisory) => (
            <div key={advisory.id} className="advisory-card" onClick={() => setViewingAdvisory(advisory)}>
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-lg mb-2 text-gray-800">
                  {advisory.update_type === "Advisory" ? "Feed Advisory" : advisory.update_type || "Consolidated Draft"}
                </h3>

                {advisory.status === 'Draft' && <span className="draft-badge">Draft</span>}
              </div>
              <p className="text-sm text-gray-600 line-clamp-4">{stripHtml(advisory.description)}</p>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-gray-500">{new Date(advisory.timestamp).toLocaleDateString()}</span>
                <div className="flex gap-2">
                  {advisory.status === 'Draft' && (<button onClick={(e) => handleOpenEditModal(advisory, e)} className="secondary-button !px-2 !py-1" title="Edit"><Edit3 size={14} /></button>)}
                  <button onClick={(e) => { e.stopPropagation(); setViewingAdvisory(advisory); }} className="secondary-button !px-2 !py-1" title="View Details"><Eye size={14} /></button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAdvisory(advisory.id);
                    }}
                    className="secondary-button !px-2 !py-1"
                    title="Delete Advisory"
                  >
                    <Delete size={14} />
                  </button>

                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ===== RSS FEED SIDEBAR (RESTORED) ===== */}
      <aside className="w-96 bg-white p-5 border-l border-gray-200 overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Latest News {selectedClientName && `for ${selectedClientName}`}
        </h2>
        {isRssLoading ? <p>Loading news...</p> :
          rssItems.length === 0 ? <p className="text-gray-500 italic">{selectedClientId ? "No items found in assigned feeds." : "Select a client to view news."}</p> : (
            <ul className="space-y-4">
              {rssItems.map((item, index) => (
                <li key={index} className="rss-item-card">
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="rss-item-title">{item.title}</a>
                  <p className="rss-item-summary">{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
      </aside>

      {/* --- Modals --- */}
      {viewingAdvisory && (<FormattedAdvisoryView advisory={viewingAdvisory} onClose={() => setViewingAdvisory(null)} />)}

      {showEditModal && editingAdvisory && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content !max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="modal-title">Review & Edit Advisory</h3>
              <button onClick={handleCloseEditModal} className="modal-close-icon"><X size={24} /></button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
              <label className="form-label">Summary</label>
              <textarea name="description" value={editFormState.description || ''} onChange={handleEditFormChange} rows="3" className="form-input"></textarea>
              <label className="form-label">Vulnerability Details</label>
              <textarea name="vulnerability_details" value={editFormState.vulnerability_details || ''} onChange={handleEditFormChange} rows="3" className="form-input"></textarea>
              <label className="form-label">Technical Analysis</label>
              <textarea name="technical_analysis" value={editFormState.technical_analysis || ''} onChange={handleEditFormChange} rows="5" className="form-input"></textarea>
              <label className="form-label">Impact</label>
              <textarea name="impact_details" value={editFormState.impact_details || ''} onChange={handleEditFormChange} rows="3" className="form-input"></textarea>
              <label className="form-label">Mitigation Strategies</label>
              <textarea name="mitigation_strategies" value={editFormState.mitigation_strategies || ''} onChange={handleEditFormChange} rows="3" className="form-input"></textarea>
              <label className="form-label">Detection and Response</label>
              <textarea name="detection_response" value={editFormState.detection_response || ''} onChange={handleEditFormChange} rows="3" className="form-input"></textarea>
              <label className="form-label">Recommendations</label>
              <textarea name="recommendations" value={editFormState.recommendations || ''} onChange={handleEditFormChange} rows="3" className="form-input"></textarea>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={handleCloseEditModal} className="secondary-button">Cancel</button>
              <button onClick={() => handleUpdateAdvisory('Draft')} className="secondary-button">Save as Draft</button>
              <button onClick={() => handleUpdateAdvisory('Sent')} className="submit-button"><Send size={16} className='mr-2' /> Dispatch</button>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && configuringClient && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between cross items-center mb-4">
              <h3 className="modal-title">Configure Tech for: {configuringClient.name}</h3>
              <button onClick={() => setShowConfigModal(false)} className="modal-close-icon"><X size={24} /></button>
            </div>
            <section>
              <h4 className="font-semibold text-gray-700 mb-2">Assigned Technologies</h4>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 border rounded-md p-4 bg-gray-50">
                {clientTechDetails.length > 0 ? (clientTechDetails.map((tech) => (
                  <div key={tech.id} className="config-item-card">
                    <h4 className="config-item-title">{tech.tech_stack_name} (Version: {tech.version})</h4>
                    <button onClick={() => handleDeleteClientTech(tech.id)} className="delete-button" title="Delete this tech stack"><X size={16} /> Delete</button>
                    <div className="mt-2">
                      <h5 className="config-item-subtitle flex items-center gap-2"><Mail size={14} /> Notification Contacts:</h5>
                      {tech.contacts.length > 0 ? (<ul className="list-disc list-inside pl-4 text-sm text-gray-600 mt-1">{tech.contacts.map((contact) => (<li key={contact.id}>{contact.email}</li>))}</ul>) : (<p className="text-xs text-gray-500 italic mt-1">No contacts assigned.</p>)}
                      <div className="flex gap-2 mt-2">
                        <input type="email" placeholder="new.contact@email.com" onBlur={(e) => setNewContactEmail(e.target.value)} className="rss-input text-sm flex-grow" />
                        <button onClick={() => handleAddContact(tech.id)} className="add-rss-button text-sm">Add</button>
                      </div>
                    </div>
                  </div>))) :
                  (<p className="text-sm text-gray-500 italic text-center p-4">No technologies assigned yet.</p>)}
              </div>
            </section>
            <div className="border-t my-4"></div>
            <section>
              <h4 className="font-semibold text-gray-700 mb-2">Assign New Tech Stack</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <select className="form-input col-span-1" value={newTechStackId} onChange={(e) => setNewTechStackId(e.target.value)}>
                  <option value="">-- Select Tech --</option>
                  {techStacks.map((stack) => (<option key={stack.id} value={stack.id}>{stack.name}</option>))}
                </select>
                <input type="text" placeholder="Version" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} className="form-input col-span-1" />
                <button onClick={handleAddClientTechVersion} className="submit-button col-span-1 whitespace-nowrap !py-2"><PlusCircle size={16} className="mr-2" /> Assign</button>
              </div>
            </section>
          </div>
        </div>
      )}

      {showTechModal && (
        <div className="modal-overlay" onClick={() => setShowTechModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between cross items-center mb-4">
              <h3 className="modal-title">Manage Tech Stacks</h3>
              <button onClick={() => setShowTechModal(false)} className="modal-close-icon"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddNewTechStack} className="flex gap-4 items-center mb-4">
              <input type="text" placeholder="New Tech Name (e.g., Ubuntu)" value={newTechName} onChange={(e) => setNewTechName(e.target.value)} className="form-input flex-grow" required />
              <button type="submit" className="submit-button whitespace-nowrap !py-2"><PlusCircle size={16} className="mr-2" /> Add Tech</button>
            </form>
            <div className="border-t my-4"></div>
            <section>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-700">Manage RSS Feeds for a Tech Stack</h4>
                {selectedTechStackId && rssFeeds.length > 0 && (<button onClick={() => { setIsDeleteMode(!isDeleteMode); setFeedsToDelete(new Set()); }} className="secondary-button !py-1">{isDeleteMode ? 'Cancel' : 'Delete Feeds'}</button>)}
              </div>
              <select className="form-input mb-3" value={selectedTechStackId} onChange={(e) => { const techId = e.target.value; setSelectedTechStackId(techId); fetchRssFeeds(techId); setIsDeleteMode(false); setFeedsToDelete(new Set()); }}>
                <option value="">-- Select Tech To Manage Feeds --</option>
                {techStacks.map(stack => (<option key={stack.id} value={stack.id}>{stack.name}</option>))}
              </select>
              <div className="space-y-2 mb-4 h-24 overflow-y-auto border rounded p-2 bg-gray-50">
                {rssFeeds.length > 0 ? rssFeeds.map((feed, index) => (
                  <li key={index} className="text-sm text-gray-600 p-1 list-none flex items-center">
                    {isDeleteMode && (<input type="checkbox" className="mr-3 h-4 w-4" checked={feedsToDelete.has(feed.url)} onChange={(e) => handleFeedSelection(e, feed.url)} />)}
                    <span className='truncate'>{feed.url}</span>
                  </li>
                )) : <p className='text-sm text-gray-400 p-2'>No feeds for this tech.</p>}
              </div>
              {isDeleteMode && feedsToDelete.size > 0 && (<button onClick={handleDeleteRssFeeds} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition ease-in-out duration-150">Delete ({feedsToDelete.size}) Selected Feed(s)</button>)}
              {!isDeleteMode && (
                <div className="flex gap-2">
                  <input type="text" placeholder="https://example.com/rss" value={newRssUrl} onChange={(e) => setNewRssUrl(e.target.value)} className="form-input flex-grow" />
                  <button onClick={handleAddRssFeed} className="add-rss-button">Add URL</button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
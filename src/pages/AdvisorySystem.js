import React, { useEffect, useState, useCallback } from 'react';
import { Briefcase, Calendar, Search, Send, Layers, Settings, X, PlusCircle, Mail, Tags, Edit3, Delete } from 'lucide-react';
// It's good practice to have a separate CSS file for component-specific styles.
import "../styles/Advisory.css";

// Helper function to strip HTML tags from RSS descriptions for cleaner display
const stripHtml = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Also remove images which can be large and disruptive
  doc.querySelectorAll('img').forEach(img => img.remove());
  return doc.body.textContent || "";
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

  // --- Advisory Creation Form State ---
  const [newAdvisory, setNewAdvisory] = useState({
    techStackId: '', version: '', updateType: '', description: '', impact: '', recommendedActions: ''
  });

  // --- RSS Feed State ---
  const [rssItems, setRssItems] = useState([]);
  const [isRssLoading, setIsRssLoading] = useState(false);

  // --- Client Configuration Modal State ---
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configuringClient, setConfiguringClient] = useState(null);
  const [clientTechDetails, setClientTechDetails] = useState([]);
  const [newTechStackId, setNewTechStackId] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');

  // --- Tech Stack Management Modal State ---
  const [showTechModal, setShowTechModal] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  // <<< NEW: State for RSS Feed deletion >>>
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [feedsToDelete, setFeedsToDelete] = useState(new Set());

  // <<< NEW: State for the Edit Advisory Modal >>>
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAdvisory, setEditingAdvisory] = useState(null);
  const [editTextContent, setEditTextContent] = useState('');



  // --- Data Fetching ---

  const fetchAdvisories = useCallback(async () => {
    // This function will now fetch the consolidated advisory from the backend
    // It's only called when a client is selected, to match the new logic.
    if (selectedClientId) {
      try {
        const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/advisories`);
        if (!response.ok) throw new Error('Failed to fetch advisories');
        const data = await response.json();

        // The backend returns a single advisory in an array.
        setAdvisories(data);
      } catch (error) {
        console.error("Error fetching advisories:", error);
        setAdvisories([]); // Clear advisories on error
      }
    } else {
      // If no client is selected, clear advisories
      setAdvisories([]);
    }
  }, [selectedClientId]);

  const [rssFeeds, setRssFeeds] = useState([]);
  const [newRssUrl, setNewRssUrl] = useState('');
  const [selectedTechStackId, setSelectedTechStackId] = useState('');

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
      try {
        await Promise.all([
          (async () => {
            const res = await fetch('http://localhost:5000/api/clients');
            const data = await res.json();
            setClients(data.map(c => ({ id: c[0], name: c[1] })));
          })(),
          fetchTechStacks()
        ]);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [fetchTechStacks]);

  // Use this effect to fetch the combined advisory whenever the selected client changes.
  useEffect(() => {
    fetchAdvisories();
  }, [selectedClientId, fetchAdvisories]);

  // This old useEffect is no longer needed because the new backend route handles this.
  // It should be removed to avoid fetching individual feed items.
  /*
  useEffect(() => {
    const fetchRssItems = async () => {
      if (!selectedClientId) {
        setRssItems([]);
        return;
      }
      setIsRssLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/feed-items`);
        const data = await response.json();
        setRssItems(Array.isArray(data) ? data.map(item => ({ ...item, summary: stripHtml(item.summary) })) : []);
      } catch (error) {
        console.error("Error fetching RSS items:", error);
        setRssItems([]);
      } finally {
        setIsRssLoading(false);
      }
    };
    fetchRssItems();
  }, [selectedClientId]);
  */


  // --- Handlers for Modals ---
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

  // <<< NEW: Handlers for the Edit Advisory Modal >>>
  const handleOpenEditModal = (advisory) => {
    setEditingAdvisory(advisory);
    setEditTextContent(advisory.advisory_content);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingAdvisory(null);
    setEditTextContent('');
  };

  const handleUpdateAdvisory = async (newStatus) => {
    if (!editingAdvisory) return;

    try {
      const response = await fetch(`http://localhost:5000/api/advisories/${editingAdvisory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advisory_content: editTextContent,
          status: newStatus // 'Draft' or 'Sent'
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to update advisory`);

      alert(`Advisory successfully ${newStatus === 'Sent' ? 'dispatched' : 'saved'}.`);
      handleCloseEditModal();
      fetchAdvisories(); // Refresh the list to show the change
    } catch (error) {
      console.error("Error updating advisory:", error);
      alert(error.message);
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
      fetchTechStacks(); // Refresh the list of tech stacks
      alert(`Successfully added '${result.name}'`);
    } catch (error) {
      console.error("Error adding new tech stack:", error);
      alert(error.message);
    }
  };

  // --- Advisory and Form Handlers ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAdvisory(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitAdvisory = async (e) => {
    e.preventDefault();
    const { techStackId, version, updateType, description } = newAdvisory;
    if (!techStackId || !version || !updateType || !description) {
      alert("Please fill out all required fields for the advisory.");
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
      setNewAdvisory({ techStackId: '', version: '', updateType: '', description: '', impact: '', recommendedActions: '' });
    } catch (error) {
      console.error("Error submitting bulk advisory:", error);
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Filtering and Derived State ---
  // This is no longer necessary as the backend returns a single advisory per client
  // const filteredAdvisories = advisories.filter(advisory =>
  //   (selectedClientId === '' || advisory.client_id === Number(selectedClientId))
  // );
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );
  const selectedClientName = clients.find(c => c.id === Number(selectedClientId))?.name || '';

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
      // Reset state and refresh the list
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
      openClientConfigModal(configuringClient); // Refresh the list
    } catch (error) {
      console.error("Failed to delete tech stack:", error);
      alert(error.message);
    }
  };









  const handleDispatchAdvisory = async (advisory) => {
    if (!window.confirm(`Are you sure you want to dispatch this advisory to all contacts?`)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/dispatch-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: advisory.title,
          content: advisory.content,
          // Assuming you have a way to link the advisory to the specific client-tech assignment
          // This ID needs to be part of the advisory object from the backend
          clientTechMapId: advisory.client_tech_map_id
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to dispatch advisory');
      }

      alert(result.message);
      // You might want to refresh the advisories after sending
      fetchAdvisories();

    } catch (error) {
      console.error("Error dispatching advisory:", error);
      alert(error.message);
    }
  };












  return (
    <div className="flex h-screen bg-gray-100 font-inter text-gray-800">
      {/* Sidebar */}
      <aside className="w-80 bg-white p-5 shadow-lg flex flex-col">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">SOC Advisory System</h2>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Clients</h3>
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={clientSearchTerm}
            onChange={(e) => setClientSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <div className="flex-grow overflow-y-auto border rounded-lg p-2 mb-4 bg-gray-50">
          {filteredClients.map(client => (
            <div
              key={client.id}
              className={`client-list-item ${selectedClientId === client.id ? 'selected' : ''}`}
              onClick={() => setSelectedClientId(client.id)}
            >
              <span className="client-name">{client.name}</span>
              <button onClick={(e) => { e.stopPropagation(); openClientConfigModal(client); }} className="client-config-button" title={`Configure ${client.name}`}>
                <Settings size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-700">Create Manual Advisory</h3>
            <button onClick={() => setShowTechModal(true)} className="secondary-button !py-1" title="Manage Tech Stacks">
              <Tags size={16} /> Manage Tech
            </button>
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
            <textarea name="description" placeholder="Description..." value={newAdvisory.description} onChange={handleInputChange} rows="3" required className="form-input"></textarea>
            <textarea name="impact" placeholder="Potential Impact..." value={newAdvisory.impact} onChange={handleInputChange} rows="2" className="form-input"></textarea>
            <textarea name="recommendedActions" placeholder="Recommended Actions..." value={newAdvisory.recommendedActions} onChange={handleInputChange} rows="3" className="form-input"></textarea>
            <button type="submit" className="submit-button" disabled={isLoading}>
              <Send size={18} className="inline-block mr-2" /> Dispatch Manually
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {selectedClientName ? `Advisories for ${selectedClientName}` : "All Dispatched Advisories"}
          </h1>
          <button onClick={() => setSelectedClientId('')} className="secondary-button">
            <Layers size={18} /> Show All
          </button>
        </div>
        {isLoading && <p>Loading advisories...</p>}
        {!isLoading && advisories.length === 0 && <p className="text-gray-500 italic text-center mt-8">{selectedClientId ? 'No advisories found for this client.' : 'No advisories have been dispatched yet.'}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {/* Renders the single advisory returned from the new backend route */}
          {advisories.map((advisory, index) => (
            <div key={index} className="advisory-card">
              <div className="prose" style={{ whiteSpace: 'pre-wrap' }}>
                <h3 className="text-xl font-bold mb-2">{advisory.title}</h3>
                <p>{advisory.content}</p>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => handleDispatchAdvisory(advisory)}
                    className="submit-button"
                    title="Dispatch advisory to client contacts"
                  >
                    <Send size={16} className='mr-2' /> Dispatch Advisory
                  </button>
                </div>


                {advisory.source_feeds && (
                  <>
                    <h4 className="font-semibold mt-4">Sources:</h4>
                    <ul className="list-disc list-inside">
                      {advisory.source_feeds.map((source, idx) => (
                        <li key={idx}>{source}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Right Sidebar for RSS Feeds */}
      {/* This section is now redundant as we are not showing individual feeds anymore */}
      {/* <aside className="w-96 bg-white p-5 border-l border-gray-200 overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Latest News {selectedClientName && `for ${selectedClientName}`}
        </h2>
        {isRssLoading ? <p>Loading news...</p> :
          rssItems.length === 0 ? <p className="text-gray-500 italic">{selectedClientId ? "No new relevant items found." : "Select a client to view news."}</p> : (
            <ul className="space-y-4">
              {rssItems.map((item, index) => (
                <li key={index} className="rss-item-card">
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="rss-item-title">{item.title}</a>
                  <p className="rss-item-summary">{item.summary}</p>
                </li>
              ))}
            </ul>
          )}
      </aside> */}

      {/* Client Configuration Modal */}
      {showConfigModal && configuringClient && (
        <div className="modal-overlay">
          <div className="modal-content">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="modal-title">Configure Tech for: {configuringClient.name}</h3>
              <button onClick={() => setShowConfigModal(false)} className="modal-close-icon">
                <X size={24} />
              </button>
            </div>

            {/* Assigned Technologies */}
            <section>
              <h4 className="font-semibold text-gray-700 mb-2">Assigned Technologies</h4>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 border rounded-md p-4 bg-gray-50">
                {clientTechDetails.length > 0 ? (
                  clientTechDetails.map((tech) => (
                    <div key={tech.id} className="config-item-card">
                      <h4 className="config-item-title">
                        {tech.tech_stack_name} (Version: {tech.version})
                      </h4>
                      <button
                        onClick={() => handleDeleteClientTech(tech.id)}
                        className="delete-button"
                        title="Delete this tech stack"
                      >
                        <X size={16} />
                        Delete
                      </button>
                      <div className="mt-2">
                        <h5 className="config-item-subtitle flex items-center gap-2">
                          <Mail size={14} /> Notification Contacts:
                        </h5>
                        {tech.contacts.length > 0 ? (
                          <ul className="list-disc list-inside pl-4 text-sm text-gray-600 mt-1">
                            {tech.contacts.map((contact) => (
                              <li key={contact.id}>{contact.email}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-500 italic mt-1">No contacts assigned.</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <input
                            type="email"
                            placeholder="new.contact@email.com"
                            onBlur={(e) => setNewContactEmail(e.target.value)}
                            className="rss-input text-sm flex-grow"
                          />
                          <button onClick={() => handleAddContact(tech.id)} className="add-rss-button text-sm">
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic text-center p-4">No technologies assigned yet.</p>
                )}
              </div>
            </section>

            {/* Divider */}
            <div className="border-t my-4"></div>

            {/* Assign New Tech Stack */}
            <section>
              <h4 className="font-semibold text-gray-700 mb-2">Assign New Tech Stack</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <select
                  className="form-input col-span-1"
                  value={newTechStackId}
                  onChange={(e) => setNewTechStackId(e.target.value)}
                >
                  <option value="">-- Select Tech --</option>
                  {techStacks.map((stack) => (
                    <option key={stack.id} value={stack.id}>
                      {stack.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Version"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="form-input col-span-1"
                />
                <button onClick={handleAddClientTechVersion} className="submit-button col-span-1 whitespace-nowrap !py-2">
                  <PlusCircle size={16} className="mr-2" /> Assign
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Tech Stack Management Modal */}
      {showTechModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="modal-title">Manage Tech Stacks</h3>
              <button onClick={() => setShowTechModal(false)} className="modal-close-icon"><X size={24} /></button>
            </div>

            <form onSubmit={handleAddNewTechStack} className="flex gap-4 items-center mb-4">
              <input
                type="text"
                placeholder="New Tech Name (e.g., Ubuntu)"
                value={newTechName}
                onChange={(e) => setNewTechName(e.target.value)}
                className="form-input flex-grow"
                required
              />
              <button type="submit" className="submit-button whitespace-nowrap !py-2">
                <PlusCircle size={16} className="mr-2" /> Add Tech
              </button>
            </form>

            <div className="border-t my-4"></div>

            <section>
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-gray-700">Manage RSS Feeds for a Tech Stack</h4>
                {selectedTechStackId && rssFeeds.length > 0 && (
                  <button
                    onClick={() => {
                      setIsDeleteMode(!isDeleteMode);
                      setFeedsToDelete(new Set());
                    }}
                    className="secondary-button !py-1"
                  >
                    {isDeleteMode ? 'Cancel' : 'Delete Feeds'}
                  </button>
                )}
              </div>

              <select
                className="form-input mb-3"
                value={selectedTechStackId}
                onChange={(e) => {
                  const techId = e.target.value;
                  setSelectedTechStackId(techId);
                  fetchRssFeeds(techId);
                  setIsDeleteMode(false);
                  setFeedsToDelete(new Set());
                }}
              >
                <option value="">-- Select Tech To Manage Feeds --</option>
                {techStacks.map(stack => (
                  <option key={stack.id} value={stack.id}>{stack.name}</option>
                ))}
              </select>

              <div className="space-y-2 mb-4 h-24 overflow-y-auto border rounded p-2 bg-gray-50">
                {rssFeeds.length > 0 ? rssFeeds.map((feed, index) => (
                  <li key={index} className="text-sm text-gray-600 p-1 list-none flex items-center">
                    {isDeleteMode && (
                      <input
                        type="checkbox"
                        className="mr-3 h-4 w-4"
                        checked={feedsToDelete.has(feed.url)}
                        onChange={(e) => handleFeedSelection(e, feed.url)}
                      />
                    )}
                    <span className='truncate'>{feed.url}</span>
                  </li>
                )) : <p className='text-sm text-gray-400 p-2'>No feeds for this tech.</p>}
              </div>

              {isDeleteMode && feedsToDelete.size > 0 && (
                <button onClick={handleDeleteRssFeeds} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition ease-in-out duration-150">
                  Delete ({feedsToDelete.size}) Selected Feed(s)
                </button>
              )}

              {!isDeleteMode && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://example.com/rss"
                    value={newRssUrl}
                    onChange={(e) => setNewRssUrl(e.target.value)}
                    className="form-input flex-grow"
                  />
                  <button onClick={handleAddRssFeed} className="add-rss-button">Add URL</button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* <<< NEW: Edit Advisory Modal >>> */}
      {showEditModal && editingAdvisory && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="modal-title">Review & Edit Advisory</h3>
              <button onClick={handleCloseEditModal} className="modal-close-icon"><X size={24} /></button>
            </div>

            <textarea
              className="w-full h-80 p-3 border rounded-md font-mono text-sm"
              value={editTextContent}
              onChange={(e) => setEditTextContent(e.target.value)}
            />

            <div className="flex justify-end gap-4 mt-4">
              <button onClick={handleCloseEditModal} className="secondary-button">
                Cancel
              </button>
              <button onClick={() => handleUpdateAdvisory('Draft')} className="secondary-button">
                Save as Draft
              </button>
              <button onClick={() => handleUpdateAdvisory('Sent')} className="submit-button">
                <Send size={16} className='mr-2' /> Dispatch Advisory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
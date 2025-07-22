import React, { useEffect, useState } from 'react';
import { Briefcase, Info, AlertTriangle, Lightbulb, User, Calendar, Search, Plus, Send, Rss, Trash2 } from 'lucide-react';
import "../styles/Advisory.css";

// Helper function to strip HTML tags and images
const stripHtml = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img').forEach(img => img.remove());
  return doc.body.textContent || "";
};

export default function AdvisorySystem() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [advisories, setAdvisories] = useState([]);
  const [newAdvisory, setNewAdvisory] = useState({
    serviceOrOS: '',
    updateType: '',
    description: '',
    impact: '',
    recommendedActions: '',
    advisoryContent: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [rssFeeds, setRssFeeds] = useState([]);
  const [newRssFeedUrl, setNewRssFeedUrl] = useState('');
  const [showRssModal, setShowRssModal] = useState(false);
  const [rssItems, setRssItems] = useState([]);
  const [rssSearchTerm, setRssSearchTerm] = useState('');
  const [isRssLoading, setIsRssLoading] = useState(false);

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedAdvisories, setSelectedAdvisories] = useState([]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/clients');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const formattedClients = data.map(clientArray => ({ id: clientArray[0], name: clientArray[1] }));
        setClients(formattedClients);
      } catch (error) {
        console.error("Error fetching clients from backend:", error);
      }
    };

    fetchClients();
  }, []);

  useEffect(() => {
    const fetchAdvisories = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:5000/api/advisories');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAdvisories(data);
      } catch (error) {
        console.error("Error fetching advisories from backend:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdvisories();
  }, []);

  // Fetch RSS feeds when a client is selected
  useEffect(() => {
    const fetchRssFeeds = async () => {
      if (!selectedClient) {
        setRssFeeds([]);
        return;
      }
      try {
        const response = await fetch(`http://localhost:5000/api/rss-feeds?client_id=${selectedClient}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setRssFeeds(data);
      } catch (error) {
        console.error("Error fetching RSS feeds:", error);
        setRssFeeds([]);
      }
    };
    fetchRssFeeds();
  }, [selectedClient]);

  // Fetch initial RSS items when a client is selected
  useEffect(() => {
    const fetchInitialRssItems = async () => {
      if (!selectedClient) {
        setRssItems([]);
        return;
      }
      setIsRssLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/rss-feed-items?client_id=${selectedClient}`);
        const data = await response.json();
        const processedItems = data.map(item => ({
          ...item,
          summary: stripHtml(item.summary)
        }));
        setRssItems(processedItems);
      } catch (error) {
        console.error("Error fetching initial RSS items:", error);
        setRssItems([]);
      } finally {
        setIsRssLoading(false);
      }
    };
    fetchInitialRssItems();
  }, [selectedClient]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAdvisory(prev => ({ ...prev, [name]: value }));
  };

  const handleRssUrlChange = (e) => {
    setNewRssFeedUrl(e.target.value);
  };
  
  const handleRssSearch = async () => {
      if (!selectedClient) return;
      setIsRssLoading(true);
      try {
          const response = await fetch(`http://localhost:5000/api/rss-feed-items?client_id=${selectedClient}&q=${rssSearchTerm}`);
          const data = await response.json();
          const processedItems = data.map(item => ({
              ...item,
              summary: stripHtml(item.summary)
          }));
          setRssItems(processedItems);
      } catch (error) {
          console.error("Error searching RSS items:", error);
          setRssItems([]);
      } finally {
          setIsRssLoading(false);
      }
  };

  const handleAddRssFeed = async () => {
    if (!newRssFeedUrl.trim()) {
      alert('Please enter a valid RSS feed URL.');
      return;
    }
    if (!selectedClient) {
        alert('Please select a client first.');
        return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newRssFeedUrl, client_id: selectedClient }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const newFeed = await response.json();
      setRssFeeds(prev => [...prev, newFeed]);
      setNewRssFeedUrl('');
      alert('RSS Feed added successfully!');
    } catch (error) {
      console.error("Error adding RSS feed:", error);
      alert('Failed to add RSS feed. Please check the URL and backend.');
    }
  };

  const handleDeleteRssFeed = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/rss-feeds/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      setRssFeeds(prev => prev.filter(feed => feed.id !== id));
      alert('RSS Feed deleted successfully!');
    } catch (error) {
      console.error("Error deleting RSS feed:", error);
      alert('Failed to delete RSS feed.');
    }
  };

  const handleSubmitAdvisory = async (e) => {
    e.preventDefault();
    if (!selectedClient) {
      alert('Please select a client before submitting an advisory.');
      return;
    }

    const clientName = clients.find(c => c.id === Number(selectedClient))?.name;

    if (!clientName) {
      alert('Selected client not found. Please try again.');
      return;
    }

    setIsLoading(true);

    const advisoryContent = `**Cybersecurity Advisory: ${newAdvisory.updateType} for ${newAdvisory.serviceOrOS}**

**Client:** ${clientName}
**Date:** ${new Date().toLocaleDateString()}

**1. Overview**
This advisory provides critical information regarding a recent ${newAdvisory.updateType} for your ${newAdvisory.serviceOrOS} environment. Staying updated is crucial for maintaining a robust security posture.

**2. Description of Update/Change**
${newAdvisory.description}

**3. Potential Impact**
${newAdvisory.impact}

**4. Recommended Actions**
${newAdvisory.recommendedActions}

We highly recommend reviewing and implementing these actions promptly to minimize potential risks. For any questions or assistance, please contact our Security Operations Center.

---
*This advisory was manually created based on gathered intelligence.*
`;

    try {
      const response = await fetch('http://localhost:5000/api/advisories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient,
          client_name: clientName,
          service_or_os: newAdvisory.serviceOrOS,
          update_type: newAdvisory.updateType,
          description: newAdvisory.description,
          impact: newAdvisory.impact,
          recommended_actions: newAdvisory.recommendedActions,
          advisory_content: advisoryContent,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedResponse = await fetch('http://localhost:5000/api/advisories');
      const updatedData = await updatedResponse.json();
      setAdvisories(updatedData);

      setNewAdvisory({
        serviceOrOS: '',
        updateType: '',
        description: '',
        impact: '',
        recommendedActions: '',
        advisoryContent: '',
      });
      alert('Advisory submitted successfully!');
    } catch (error) {
      console.error("Error adding advisory to backend:", error);
      alert('Failed to submit advisory. Please check your backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAdvisories = advisories.filter(advisory =>
    (selectedClient === '' || advisory.client_id === Number(selectedClient)) &&
    (searchTerm === '' ||
      advisory.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      advisory.service_or_os.toLowerCase().includes(searchTerm.toLowerCase()) ||
      advisory.update_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      advisory.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      advisory.advisory_content.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => {
    const dateA = new Date(a.timestamp || 0);
    const dateB = new Date(b.timestamp || 0);
    return dateB - dateA;
  });

  const handleSelectAdvisory = (id) => {
    setSelectedAdvisories(prevSelected => {
      if (prevSelected.includes(id)) {
        return prevSelected.filter(advisoryId => advisoryId !== id);
      } else {
        return [...prevSelected, id];
      }
    });
  };

  const handleDeleteAdvisories = async () => {
    if (selectedAdvisories.length === 0) {
      alert("Please select at least one advisory to delete.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedAdvisories.length} selected advisory/advisories?`)) {
      try {
        const response = await fetch('http://localhost:5000/api/advisories/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedAdvisories }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        setAdvisories(prev => prev.filter(advisory => !selectedAdvisories.includes(advisory.id)));
        setIsDeleteMode(false);
        setSelectedAdvisories([]);
        alert('Advisories deleted successfully!');
      } catch (error) {
        console.error("Error deleting advisories:", error);
        alert(`Failed to delete advisories: ${error.message}`);
      }
    }
  };

  const selectedClientName = clients.find(c => c.id === Number(selectedClient))?.name || '';

  return (
    <div className="flex min-h-screen bg-gray-100 font-inter">
      {/* Sidebar */}
      <div className="w-64 bg-white p-6 shadow-md flex flex-col">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Clients</h2>
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="w-full p-2 border border-gray-300 rounded-lg mb-4 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
        >
          <option value="">Select a Client</option>
          {clients.map(client => (
            <option key={client.id} value={client.id}>{client.name}</option>
          ))}
        </select>

        <h3 className="text-lg font-medium text-gray-700 mb-4 mt-6">Create New Advisory</h3>
        <form onSubmit={handleSubmitAdvisory} className="space-y-4">
          <input
            type="text"
            name="serviceOrOS"
            placeholder="Service/OS Affected (e.g., Windows Server 2019)"
            value={newAdvisory.serviceOrOS}
            onChange={handleInputChange}
            required
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            name="updateType"
            value={newAdvisory.updateType}
            onChange={handleInputChange}
            required
            className="w-full p-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Update Type</option>
            <option value="Security Patch">Security Patch</option>
            <option value="Vulnerability Alert">Vulnerability Alert</option>
            <option value="Feature Update">Feature Update</option>
            <option value="Configuration Change">Configuration Change</option>
            <option value="Advisory">General Advisory</option>
          </select>
          <textarea
            name="description"
            placeholder="Description of the update/change"
            value={newAdvisory.description}
            onChange={handleInputChange}
            rows="3"
            required
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
          <textarea
            name="impact"
            placeholder="Potential Impact on client"
            value={newAdvisory.impact}
            onChange={handleInputChange}
            rows="2"
            required
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
          <textarea
            name="recommendedActions"
            placeholder="Recommended Actions for client"
            value={newAdvisory.recommendedActions}
            onChange={handleInputChange}
            rows="3"
            required
            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          ></textarea>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center justify-center gap-2"
            disabled={!selectedClient || isLoading}
          >
            <Send size={18} /> Submit Advisory
          </button>
        </form>

        <button
          onClick={() => setShowRssModal(true)}
          className="mt-6 w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition duration-200 flex items-center justify-center gap-2"
          disabled={!selectedClient}
        >
          <Rss size={18} /> Manage RSS Feeds
        </button>
      </div>

      {/* Conditional Rendering for Main Content */}
      {selectedClient ? (
        <>
          {/* Main Content Area */}
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Client Advisories</h1>
                {!isDeleteMode ? (
                    <button
                        onClick={() => setIsDeleteMode(true)}
                        className="delete-advisory-button"
                    >
                        <Trash2 size={18} /> Delete Advisories
                    </button>
                ) : (
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleDeleteAdvisories}
                            className="confirm-delete-button"
                            disabled={selectedAdvisories.length === 0}
                        >
                            Delete Selected ({selectedAdvisories.length})
                        </button>
                        <button
                            onClick={() => {
                                setIsDeleteMode(false);
                                setSelectedAdvisories([]);
                            }}
                            className="cancel-delete-button"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {isLoading ? (
              <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-600 flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p>Loading advisories...</p>
              </div>
            ) : filteredAdvisories.length === 0 ? (
              <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-600">
                <p>No advisories found for this client.</p>
                <p className="mt-2">Use the form on the left to create a new advisory.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                {filteredAdvisories.map(advisory => (
                  <div 
                    key={advisory.id} 
                    className={`advisory-card bg-white p-6 rounded-lg shadow-md border border-gray-200 ${isDeleteMode ? 'is-deleting' : ''} ${selectedAdvisories.includes(advisory.id) ? 'selected' : ''}`}
                    onClick={() => isDeleteMode && handleSelectAdvisory(advisory.id)}
                  >
                    {isDeleteMode && (
                        <input
                            type="checkbox"
                            className="advisory-checkbox"
                            checked={selectedAdvisories.includes(advisory.id)}
                            readOnly
                        />
                    )}
                    <div className="flex items-center mb-4">
                      <Briefcase size={20} className="text-blue-600 mr-2" />
                      <h2 className="text-xl font-semibold text-gray-800">{advisory.client_name}</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                      <Calendar size={14} />
                      {advisory.timestamp ? new Date(advisory.timestamp).toLocaleString() : 'N/A'}
                    </p>
                    <div className="prose max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: advisory.advisory_content.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Cybersecurity News Section */}
          <div className="w-96 bg-white p-6 border-l border-gray-200 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Latest Cybersecurity News {selectedClientName && `for ${selectedClientName}`}
            </h2>
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    placeholder="Search news..."
                    className="w-full pl-4 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={rssSearchTerm}
                    onChange={(e) => setRssSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRssSearch()}
                />
                <button onClick={handleRssSearch} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Search size={18} />
                </button>
            </div>
            {isRssLoading ? (
                <p className="text-gray-600">Searching...</p>
            ) : rssItems.length === 0 ? (
              <p className="text-gray-600">{selectedClient ? "No news available for this client or search term." : "Please select a client to see news."}</p>
            ) : (
              <ul className="space-y-4">
                {rssItems.map((item, index) => (
                  <li key={index} className="bg-white p-4 rounded-lg shadow-md border">
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold">
                      {item.title}
                    </a>
                    <p className="text-gray-700 mt-2">{item.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 p-8 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-md text-center text-gray-600 max-w-md">
            <Info size={48} className="mx-auto mb-4 text-blue-500" />
            <h2 className="text-2xl font-semibold mb-2">Welcome to the Advisory System</h2>
            <p>Please select a client from the sidebar to view their advisories and news feeds.</p>
          </div>
        </div>
      )}

      {/* RSS Feed Management Modal */}
      {showRssModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Manage RSS Feeds for {selectedClientName}</h3>
            <div className="rss-input-group">
              <input
                type="url"
                placeholder="Enter RSS Feed URL"
                value={newRssFeedUrl}
                onChange={handleRssUrlChange}
                className="rss-input"
              />
              <button onClick={handleAddRssFeed} className="add-rss-button">
                Add Feed
              </button>
            </div>
            <ul className="rss-list">
              {rssFeeds.length === 0 ? (
                <li className="no-rss-message">No RSS feeds for this client.</li>
              ) : (
                rssFeeds.map(feed => (
                  <li key={feed.id} className="rss-item">
                    <span className="rss-url">{feed.url}</span>
                    <button onClick={() => handleDeleteRssFeed(feed.id)} className="delete-rss-button">
                      Delete
                    </button>
                  </li>
                ))
              )}
            </ul>
            <button onClick={() => setShowRssModal(false)} className="modal-close-button">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

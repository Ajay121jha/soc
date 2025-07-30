import React, { useEffect, useState } from 'react';
import { Briefcase, Info, Calendar, Search, Plus, Send, Rss, Trash2, Layers, Settings, X } from 'lucide-react';
import "../styles/Advisory.css";

// Helper function to strip HTML tags from RSS descriptions
const stripHtml = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('img').forEach(img => img.remove());
    return doc.body.textContent || "";
};

export default function AdvisorySystem() {
    // --- Core State ---
    const [clients, setClients] = useState([]);
    const [techStacks, setTechStacks] = useState([]);
    const [advisories, setAdvisories] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // --- UI and Filtering State ---
    const [selectedClient, setSelectedClient] = useState('');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    
    // --- Advisory Creation State ---
    const [newAdvisory, setNewAdvisory] = useState({
        techStackId: '', version: '', updateType: '', description: '', impact: '', recommendedActions: ''
    });
    
    // --- RSS Feed Management Modal State ---
    const [showRssModal, setShowRssModal] = useState(false);
    const [selectedTechStackForFeeds, setSelectedTechStackForFeeds] = useState('');
    const [rssFeeds, setRssFeeds] = useState([]);
    const [newRssFeedUrl, setNewRssFeedUrl] = useState('');
    const [rssItems, setRssItems] = useState([]);
    const [isRssLoading, setIsRssLoading] = useState(false);
    
    // --- Client Configuration Modal State ---
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [configuringClient, setConfiguringClient] = useState(null);
    const [clientTechDetails, setClientTechDetails] = useState([]);
    const [newTechStackId, setNewTechStackId] = useState('');
    const [newVersion, setNewVersion] = useState('');
    const [newContactEmail, setNewContactEmail] = useState('');

    // --- Initial Data Fetch ---
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [clientsRes, advisoriesRes, techStacksRes] = await Promise.all([
                    fetch('http://localhost:5000/api/clients'),
                    fetch('http://localhost:5000/api/advisories'),
                    fetch('http://localhost:5000/api/tech-stacks')
                ]);
                const clientsData = await clientsRes.json();
                const formattedClients = clientsData.map(c => ({ id: c[0], name: c[1] }));
                setClients(formattedClients);
                setAdvisories(await advisoriesRes.json());
                setTechStacks(await techStacksRes.json());
            } catch (error) {
                console.error("Error fetching initial data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // Fetch RSS items when a client is selected for viewing
    useEffect(() => {
        const fetchRssItems = async () => {
            if (!selectedClient) {
                setRssItems([]);
                return;
            }
            setIsRssLoading(true);
            try {
                const response = await fetch(`http://localhost:5000/api/clients/${selectedClient}/feed-items`);
                const data = await response.json();
                setRssItems(Array.isArray(data) ? data.map(item => ({...item, summary: stripHtml(item.summary)})) : []);
            } catch (error) {
                console.error("Error fetching RSS items:", error);
                setRssItems([]);
            } finally {
                setIsRssLoading(false);
            }
        };
        fetchRssItems();
    }, [selectedClient]);
    
    // --- Handlers for Client Configuration Modal ---
    const openClientConfigModal = async (client) => {
        setConfiguringClient(client);
        try {
            const response = await fetch(`http://localhost:5000/api/clients/${client.id}/tech`);
            const data = await response.json();
            setClientTechDetails(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch client tech details", error);
            setClientTechDetails([]);
        }
        setShowConfigModal(true);
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
            openClientConfigModal(configuringClient); // Refresh data
        } catch (error) {
            console.error("Failed to add tech version:", error);
        }
    };
    
    const handleAddContact = async (clientTechId) => {
        if (!newContactEmail.trim()) {
            alert('Please enter an email address.');
            return;
        }
        try {
            await fetch(`http://localhost:5000/api/client-tech/${clientTechId}/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newContactEmail }),
            });
            setNewContactEmail('');
            openClientConfigModal(configuringClient); // Refresh data
        } catch (error) {
            console.error("Failed to add contact:", error);
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
            // Backend handles finding clients and sending emails via Graph API
            const response = await fetch('http://localhost:5000/api/advisories/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAdvisory),
            });
            if (!response.ok) throw new Error('Failed to submit bulk advisory');
            
            const advisoriesRes = await fetch('http://localhost:5000/api/advisories');
            setAdvisories(await advisoriesRes.json());
            alert('Advisory has been dispatched to all relevant clients.');
            setNewAdvisory({techStackId: '', version: '', updateType: '', description: '', impact: '', recommendedActions: ''});
        } catch (error) {
            console.error("Error submitting bulk advisory:", error);
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredAdvisories = advisories.filter(advisory =>
        (selectedClient === '' || advisory.client_id === Number(selectedClient))
    ).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const filteredClients = clients.filter(client => 
        client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
    );

    const selectedClientName = clients.find(c => c.id === Number(selectedClient))?.name || '';
    
    return (
        <div className="flex min-h-screen bg-gray-100 font-inter">
            {/* Sidebar */}
            <div className="w-80 bg-white p-6 shadow-md flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">SOC Advisory System</h2>
                
                <h3 className="text-lg font-medium text-gray-700 mb-2">Clients</h3>
                <div className="relative mb-2">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Search clients..."
                        value={clientSearchTerm}
                        onChange={(e) => setClientSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex-grow overflow-y-auto border rounded-lg p-2 mb-4">
                    {filteredClients.map(client => (
                        <div 
                            key={client.id} 
                            className={`client-list-item ${selectedClient == client.id ? 'selected' : ''}`}
                            onClick={() => setSelectedClient(client.id)}
                        >
                            <span className="client-name">{client.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); openClientConfigModal(client); }} className="client-config-button" title={`Configure ${client.name}`}>
                                <Settings size={18} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="border-t my-4"></div>

                <h3 className="text-lg font-medium text-gray-700 mb-4">Create Bulk Advisory</h3>
                <form onSubmit={handleSubmitAdvisory} className="space-y-3">
                    <select name="techStackId" value={newAdvisory.techStackId} onChange={handleInputChange} required className="form-input">
                        <option value="">-- Select Tech Stack --</option>
                        {techStacks.map(stack => <option key={stack.id} value={stack.id}>{stack.name}</option>)}
                    </select>
                    <input type="text" name="version" placeholder="Version (e.g., 22H2, 11.x)" value={newAdvisory.version} onChange={handleInputChange} required className="form-input"/>
                    <select name="updateType" value={newAdvisory.updateType} onChange={handleInputChange} required className="form-input">
                        <option value="">-- Select Update Type --</option>
                        <option value="Security Patch">Security Patch</option>
                        <option value="Vulnerability Alert">Vulnerability Alert</option>
                    </select>
                    <textarea name="description" placeholder="Description..." value={newAdvisory.description} onChange={handleInputChange} rows="3" required className="form-input"></textarea>
                    <textarea name="impact" placeholder="Potential Impact..." value={newAdvisory.impact} onChange={handleInputChange} rows="2" className="form-input"></textarea>
                    <textarea name="recommendedActions" placeholder="Recommended Actions..." value={newAdvisory.recommendedActions} onChange={handleInputChange} rows="3" className="form-input"></textarea>
                    <button type="submit" className="submit-button" disabled={isLoading}>
                        <Send size={18} className="inline-block mr-2"/> Dispatch Advisory
                    </button>
                </form>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Advisory Feed</h1>
                    <button onClick={() => setShowRssModal(true)} className="manage-feeds-button">
                        <Layers size={18} /> Manage Tech Feeds
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAdvisories.map(advisory => (
                        <div key={advisory.id} className="advisory-card">
                             <div className="flex items-center mb-4">
                                <Briefcase size={20} className="text-blue-600 mr-2" />
                                <h2 className="text-xl font-semibold text-gray-800">{advisory.client_name}</h2>
                            </div>
                            <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">
                                <Calendar size={14} />{advisory.timestamp ? new Date(advisory.timestamp).toLocaleString() : 'N/A'}
                            </p>
                            <div className="prose" dangerouslySetInnerHTML={{ __html: advisory.advisory_content.replace(/\n/g, '<br/>') }} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Sidebar for RSS Feeds */}
            <div className="w-96 bg-white p-6 border-l border-gray-200 overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Latest News {selectedClientName && `for ${selectedClientName}`}
                </h2>
                {isRssLoading ? <p>Loading news...</p> :
                 rssItems.length === 0 ? <p className="text-gray-500 italic">{selectedClient ? "No news available." : "Select a client to view news."}</p> : (
                    <ul className="space-y-4">
                        {rssItems.map((item, index) => (
                            <li key={index} className="rss-item-card">
                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="rss-item-title">{item.title}</a>
                                <p className="rss-item-summary">{item.summary}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Client Configuration Modal */}
            {showConfigModal && configuringClient && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '700px'}}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="modal-title">Configure: {configuringClient.name}</h3>
                            <button onClick={() => setShowConfigModal(false)} className="modal-close-icon"><X size={24}/></button>
                        </div>
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {clientTechDetails.map(tech => (
                                <div key={tech.id} className="config-item-card">
                                    <h4 className="config-item-title">{tech.tech_stack_name} (v{tech.version})</h4>
                                    <div className="mt-3">
                                        <h5 className="config-item-subtitle">Notification Contacts:</h5>
                                        {tech.contacts.length > 0 ? (
                                            <ul className="list-disc list-inside pl-2 text-sm text-gray-600">
                                                {tech.contacts.map(contact => <li key={contact.id}>{contact.email}</li>)}
                                            </ul>
                                        ) : <p className="text-xs text-gray-500 italic">No contacts assigned.</p>}
                                        <div className="flex gap-2 mt-2">
                                            <input type="email" placeholder="new.contact@email.com" onChange={(e) => setNewContactEmail(e.target.value)} className="rss-input text-sm"/>
                                            <button onClick={() => handleAddContact(tech.id)} className="add-rss-button text-sm">Add</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="border-t my-4"></div>
                        <h4 className="font-semibold text-gray-700 mb-2">Assign New Tech Stack</h4>
                        <div className="grid grid-cols-3 gap-4 items-end">
                            <select className="form-input col-span-1" onChange={(e) => setNewTechStackId(e.target.value)}>
                                <option value="">-- Select Tech --</option>
                                {techStacks.map(stack => <option key={stack.id} value={stack.id}>{stack.name}</option>)}
                            </select>
                            <input type="text" placeholder="Version" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} className="form-input col-span-1"/>
                            <button onClick={handleAddClientTechVersion} className="add-rss-button col-span-1 whitespace-nowrap">Assign to Client</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* RSS Feed Management Modal */}
            {showRssModal && (
                 <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 className="modal-title">Manage Feeds by Tech Stack</h3>
                         <select
                             className="form-input mb-4"
                             value={selectedTechStackForFeeds}
                             onChange={(e) => setSelectedTechStackForFeeds(e.target.value)}>
                             <option value="">-- Select a Tech Stack --</option>
                             {techStacks.map(stack => <option key={stack.id} value={stack.id}>{stack.name}</option>)}
                         </select>
                         <div className="rss-input-group">
                             <input type="url" placeholder="Enter new RSS Feed URL" value={newRssFeedUrl} onChange={(e) => setNewRssFeedUrl(e.target.value)} className="rss-input" />
                             <button className="add-rss-button">Add Feed</button>
                         </div>
                         <button onClick={() => setShowRssModal(false)} className="modal-close-button">Close</button>
                     </div>
                 </div>
            )}
        </div>
    );
}

import React, { useEffect, useState, useCallback } from 'react';
import { Briefcase, Calendar, Search, Send, Layers, Settings, X, PlusCircle, Mail, Tags } from 'lucide-react';
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

    // --- Data Fetching ---
    const fetchAdvisories = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5000/api/advisories');
            setAdvisories(await response.json());
        } catch (error) {
            console.error("Error fetching advisories:", error);
        }
    }, []);

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
                    fetchTechStacks(),
                    fetchAdvisories()
                ]);
            } catch (error) {
                console.error("Error fetching initial data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [fetchAdvisories, fetchTechStacks]);

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
                setRssItems(Array.isArray(data) ? data.map(item => ({...item, summary: stripHtml(item.summary)})) : []);
            } catch (error) {
                console.error("Error fetching RSS items:", error);
                setRssItems([]);
            } finally {
                setIsRssLoading(false);
            }
        };
        fetchRssItems();
    }, [selectedClientId]);
    
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
            
            await fetchAdvisories();
            alert(result.message);
            setNewAdvisory({techStackId: '', version: '', updateType: '', description: '', impact: '', recommendedActions: ''});
        } catch (error) {
            console.error("Error submitting bulk advisory:", error);
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Filtering and Derived State ---
    const filteredAdvisories = advisories.filter(advisory =>
        (selectedClientId === '' || advisory.client_id === Number(selectedClientId))
    );
    const filteredClients = clients.filter(client => 
        client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
    );
    const selectedClientName = clients.find(c => c.id === Number(selectedClientId))?.name || '';
    
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
                        <h3 className="text-lg font-semibold text-gray-700">Create Bulk Advisory</h3>
                        <button onClick={() => setShowTechModal(true)} className="secondary-button !py-1" title="Manage Tech Stacks">
                            <Tags size={16} /> Manage Tech
                        </button>
                    </div>
                    <form onSubmit={handleSubmitAdvisory} className="space-y-3">
                        <select name="techStackId" value={newAdvisory.techStackId} onChange={handleInputChange} required className="form-input">
                            <option value="">-- Select Tech Stack --</option>
                            {techStacks.map(stack => <option key={stack.id} value={stack.id}>{stack.name}</option>)}
                        </select>
                        <input type="text" name="version" placeholder="Version (e.g., 22H2, 11.x, *)" value={newAdvisory.version} onChange={handleInputChange} required className="form-input"/>
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
                            <Send size={18} className="inline-block mr-2"/> Dispatch to All Affected
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
                {!isLoading && filteredAdvisories.length === 0 && <p className="text-gray-500 italic text-center mt-8">{selectedClientId ? 'No advisories found for this client.' : 'No advisories have been dispatched yet.'}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    {filteredAdvisories.map(advisory => (
                        <div key={advisory.id} className="advisory-card">
                             <div className="flex items-center mb-3">
                                <Briefcase size={20} className="text-blue-600 mr-3" />
                                <h2 className="text-xl font-semibold text-gray-800">{advisory.client_name}</h2>
                            </div>
                            <p className="text-sm text-gray-500 mb-4 flex items-center gap-2">
                                <Calendar size={14} />{advisory.timestamp ? new Date(advisory.timestamp).toLocaleString() : 'N/A'}
                            </p>
                            <div className="prose" style={{whiteSpace: 'pre-wrap'}} dangerouslySetInnerHTML={{ __html: advisory.advisory_content }} />
                        </div>
                    ))}
                </div>
            </main>

            {/* Right Sidebar for RSS Feeds */}
            <aside className="w-96 bg-white p-5 border-l border-gray-200 overflow-y-auto">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Latest News {selectedClientName && `for ${selectedClientName}`}
                </h2>
                {isRssLoading ? <p>Loading news...</p> :
                 rssItems.length === 0 ? <p className="text-gray-500 italic">{selectedClientId ? "No news available for this client's tech stack." : "Select a client to view relevant news."}</p> : (
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

            {/* Client Configuration Modal */}
            {showConfigModal && configuringClient && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '700px'}}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="modal-title">Configure Tech for: {configuringClient.name}</h3>
                            <button onClick={() => setShowConfigModal(false)} className="modal-close-icon"><X size={24}/></button>
                        </div>
                        <h4 className="font-semibold text-gray-700 mb-2">Assigned Technologies</h4>
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-2 border rounded-md p-4 bg-gray-50">
                            {clientTechDetails.length > 0 ? clientTechDetails.map(tech => (
                                <div key={tech.id} className="config-item-card">
                                    <h4 className="config-item-title">{tech.tech_stack_name} (Version: {tech.version})</h4>
                                    <div className="mt-2">
                                        <h5 className="config-item-subtitle flex items-center gap-2"><Mail size={14}/> Notification Contacts:</h5>
                                        {tech.contacts.length > 0 ? (
                                            <ul className="list-disc list-inside pl-4 text-sm text-gray-600 mt-1">
                                                {tech.contacts.map((contact) => <li key={contact.id}>{contact.email}</li>)}
                                            </ul>
                                        ) : <p className="text-xs text-gray-500 italic mt-1">No contacts assigned.</p>}
                                        <div className="flex gap-2 mt-2">
                                            <input type="email" placeholder="new.contact@email.com" onBlur={(e) => setNewContactEmail(e.target.value)} className="rss-input text-sm flex-grow"/>
                                            <button onClick={() => handleAddContact(tech.id)} className="add-rss-button text-sm">Add</button>
                                        </div>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-gray-500 italic text-center p-4">No technologies assigned yet.</p>}
                        </div>
                        <div className="border-t my-4"></div>
                        <h4 className="font-semibold text-gray-700 mb-2">Assign New Tech Stack</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <select className="form-input col-span-1" value={newTechStackId} onChange={(e) => setNewTechStackId(e.target.value)}>
                                <option value="">-- Select Tech --</option>
                                {techStacks.map(stack => <option key={stack.id} value={stack.id}>{stack.name}</option>)}
                            </select>
                            <input type="text" placeholder="Version" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} className="form-input col-span-1"/>
                            <button onClick={handleAddClientTechVersion} className="submit-button col-span-1 whitespace-nowrap !py-2">
                                <PlusCircle size={16} className="mr-2"/> Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW: Tech Stack Management Modal */}
            {showTechModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth: '500px'}}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="modal-title">Manage Tech Stacks</h3>
                            <button onClick={() => setShowTechModal(false)} className="modal-close-icon"><X size={24}/></button>
                        </div>
                        
                        <h4 className="font-semibold text-gray-700 mb-2">Existing Tech Stacks</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 border rounded-md p-3 bg-gray-50 mb-4">
                            {techStacks.length > 0 ? techStacks.map(tech => (
                                <div key={tech.id} className="p-2 bg-white rounded border">{tech.name}</div>
                            )) : <p className="text-sm text-gray-500 italic">No tech stacks defined.</p>}
                        </div>

                        <div className="border-t my-4"></div>

                        <h4 className="font-semibold text-gray-700 mb-2">Add New Tech Stack</h4>
                        <form onSubmit={handleAddNewTechStack} className="flex gap-4 items-center">
                            <input 
                                type="text" 
                                placeholder="e.g., CentOS, Ubuntu, Cisco IOS" 
                                value={newTechName} 
                                onChange={(e) => setNewTechName(e.target.value)} 
                                className="form-input flex-grow"
                                required
                            />
                            <button type="submit" className="submit-button whitespace-nowrap !py-2">
                                <PlusCircle size={16} className="mr-2"/> Add Tech
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

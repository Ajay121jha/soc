"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Eye,
  Search,
  Send,
  Settings,
  X,
  PlusCircle,
  Mail,
  Tags,
  Edit3,
  Delete,
  Users,
  FilePlus,
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Sparkles,
} from "lucide-react"
import { Link } from "react-router-dom";
import "../styles/Advisory.css"
import FormattedAdvisoryView from "./FormattedAdvisoryView"

const stripHtml = (html) => {
  if (!html) return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.querySelectorAll("img").forEach((img) => img.remove())
  return doc.body.textContent || ""
}

const initialAdvisoryState = {
  techStackId: "",
  updateType: "",
  description: "",
  vulnerability_details: "",
  technical_analysis: "",
  impact_details: "",
  mitigation_strategies: "",
  detection_response: "",
  recommendations: ""
}



export default function AdvisorySystem() {
  // --- Core Data State ---
  const [clients, setClients] = useState([])
  const [techStacks, setTechStacks] = useState([])
  const [advisories, setAdvisories] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // --- UI and Filtering State ---
  const [selectedClientId, setSelectedClientId] = useState("")
  const [clientSearchTerm, setClientSearchTerm] = useState("")
  const [viewingAdvisory, setViewingAdvisory] = useState(null)
  const [activeTab, setActiveTab] = useState("clients")


  //adding new category and subcategory
  // const [newCategoryName, setNewCategoryName] = useState("");
  // const [newSubcategoryName, setNewSubcategoryName] = useState("");


  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubCategoryName, setNewSubCategoryName] = useState("");
  const [newTechnologyName, setNewTechnologyName] = useState("");



  // --- Advisory Creation Form State ---
  const [newAdvisory, setNewAdvisory] = useState(initialAdvisoryState)

  const [categories, setCategories] = useState([]);



  const [selectedCategory, setSelectedCategory] = useState("");
  const [subCategories, setSubCategories] = useState([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  // const [selectedTechStackId, setSelectedTechStackId] = useState("");

  // --- Escalation Matrix State ---
  const [escalationContacts, setEscalationContacts] = useState({ L1: [], L2: [], L3: [] });
  const [newEscalationContactEmail, setNewEscalationContactEmail] = useState("");
  const [newEscalationContactLevel, setNewEscalationContactLevel] = useState("L1");


  // --- RSS Feed State ---
  const [rssItems, setRssItems] = useState([])
  const [isRssLoading, setIsRssLoading] = useState(false)
  const [rssFeeds, setRssFeeds] = useState([])
  const [newRssUrl, setNewRssUrl] = useState("")
  const [selectedFeedCategory, setSelectedFeedCategory] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(null);


  // --- Modal States ---
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configuringClient, setConfiguringClient] = useState(null)
  const [clientTechDetails, setClientTechDetails] = useState([])
  const [newTechStackId, setNewTechStackId] = useState("")
  const [showTechModal, setShowTechModal] = useState(false)
  const [newTechName, setNewTechName] = useState("")
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [feedsToDelete, setFeedsToDelete] = useState(new Set())
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingAdvisory, setEditingAdvisory] = useState(null)
  const [editFormState, setEditFormState] = useState(null)
  const [selectedConfigCategory, setSelectedConfigCategory] = useState("");
  const [configSubCategories, setConfigSubCategories] = useState([]);
  const [selectedConfigSubCategory, setSelectedConfigSubCategory] = useState("");

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailPreview, setEmailPreview] = useState(null)
  const [emailTemplate, setEmailTemplate] = useState("standard")
  const [customSubject, setCustomSubject] = useState("")
  const [emailRecipients, setEmailRecipients] = useState([])

  const fetchAdvisories = useCallback(async () => {
    if (selectedClientId) {
      setIsLoading(true)
      try {
        const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/advisories`)
        if (!response.ok) throw new Error("Failed to fetch advisories")
        const data = await response.json()
        setAdvisories(data)
      } catch (error) {
        console.error("Error fetching advisories:", error)
        setAdvisories([])
      } finally {
        setIsLoading(false)
      }
    } else {
      setAdvisories([])
    }
  }, [selectedClientId])

  const fetchTechStacks = useCallback(async (subcategoryId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/tech-stacks/${subcategoryId}`)
      setTechStacks(await res.json())
    } catch (error) {
      console.error("Error fetching tech stacks:", error)
    }
  }, [])











  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const res = await fetch("http://localhost:5000/api/clients");
      const data = await res.json();
      setClients(data.map((c) => ({ id: c[0], name: c[1] })));
      await fetchTechStacks(selectedSubCategory);
      setIsLoading(false);
    };
    fetchInitialData();
  }, [fetchTechStacks, selectedSubCategory]);







  // Move this to the top-level scope of your component
  const fetchCategories = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/categories");
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  // Then keep your useEffect as-is
  useEffect(() => {
    fetchCategories();
  }, []);



  const fetchEscalationMatrix = useCallback(async () => {
    if (!selectedClientId) return;
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/escalation-matrix`);
      if (!response.ok) throw new Error("Failed to fetch escalation matrix");
      const data = await response.json();
      setEscalationContacts(data);
    } catch (error) {
      console.error("Error fetching escalation matrix:", error);
      setEscalationContacts({ L1: [], L2: [], L3: [] });
    }
  }, [selectedClientId]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true)
      const res = await fetch("http://localhost:5000/api/clients")
      const data = await res.json()
      setClients(data.map((c) => ({ id: c[0], name: c[1] })))
      await fetchTechStacks(selectedSubCategory)
      setIsLoading(false)
    }
    fetchInitialData()
  }, [fetchTechStacks])

  useEffect(() => {
    if (selectedClientId) {
      setIsLoading(true)
      const fetchAllData = async () => {
        await Promise.all([fetchAdvisories(), fetchEscalationMatrix()]);

        setIsRssLoading(true)
        try {
          const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/feed-items`)
          const rssData = await response.json()

          setRssItems(
            Array.isArray(rssData) ? rssData.map((item, index) => ({ ...item, id: `rss-${index}`, summary: stripHtml(item.summary) })) : [],
          )
        } catch (error) {
          console.error("Error fetching RSS items:", error)
          setRssItems([])
        } finally {
          setIsRssLoading(false)
          setIsLoading(false)
        }
      }
      fetchAllData()
    } else {
      setAdvisories([])
      setRssItems([])
      setEscalationContacts({ L1: [], L2: [], L3: [] });
    }
  }, [selectedClientId, fetchAdvisories, fetchEscalationMatrix])

  const handleGenerateAiAdvisory = async (rssItem) => {
    setIsAiGenerating(rssItem.id);
    try {
      const response = await fetch('http://localhost:5000/api/generate-advisory-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: rssItem.title, summary: rssItem.summary }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate AI advisory');
      }

      const generatedData = await response.json();

      setNewAdvisory({
        ...initialAdvisoryState,
        description: generatedData.summary || '',
        vulnerability_details: generatedData.vulnerability_details || '',
        technical_analysis: generatedData.technical_analysis || '',
        impact_details: generatedData.impact_assessment || '',
        mitigation_strategies: generatedData.mitigation_strategies || '',
        detection_response: generatedData.detection_and_response || '',
        recommendations: generatedData.recommendations || '',
        updateType: generatedData.update_type || 'Vulnerability Alert',
      });

      setActiveTab('create');
      alert('Advisory has been drafted by AI. Please review and dispatch.');

    } catch (error) {
      console.error("Error generating AI advisory:", error);
      alert(`AI Generation Failed: ${error.message}`);
    } finally {
      setIsAiGenerating(null);
    }
  };


  const generateEmailContent = (advisory, template = "standard") => {
    const body = `
Dear Team,

This is a security advisory regarding ${advisory.service_or_os}.

Summary:
${advisory.description}

Recommendations:
${advisory.recommendations || "Please review the full advisory for details."}

This is an automated notification from the Advisory System.
    `;
    const templates = {
      standard: {
        subject: `Security Advisory: ${advisory.update_type} for ${advisory.service_or_os}`,
        body: body
      },
      urgent: {
        subject: `🚨 URGENT: ${advisory.update_type} - ${advisory.service_or_os} - Immediate Action Required`,
        body: `URGENT ACTION REQUIRED\n\n${body}`
      },
      brief: {
        subject: `Advisory Update: ${advisory.service_or_os}`,
        body: `Quick update for ${advisory.service_or_os}:\n\n${advisory.description}`
      },
    }
    return templates[template] || templates.standard
  }

  const openEmailModal = async (advisory) => {
    setEmailPreview(advisory)
    setEmailRecipients([])
    setShowEmailModal(true)
    try {
      const response = await fetch(`http://localhost:5000/api/advisories/${advisory.id}/recipients`)
      if (response.ok) {
        const recipients = await response.json()
        setEmailRecipients(recipients)
      } else {
        console.error("Failed to fetch recipients, server responded with:", response.status)
        setEmailRecipients(["Error fetching recipients."])
      }
    } catch (error) {
      console.error("Error fetching recipients:", error)
      setEmailRecipients(["Error fetching recipients."])
    }
  }

  const sendAdvisoryEmail = async (advisory, template = "standard", customSubject = "") => {
    try {
      const emailContent = generateEmailContent(advisory, template)
      const response = await fetch("http://localhost:5000/api/dispatch-advisory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customSubject || emailContent.subject,
          content: emailContent.body,
          advisoryId: advisory.id,
          priority: template === "urgent" ? "high" : "normal",
        }),
      })
      const result = await response.json()
      alert(result.message || result.error)
      if (response.ok) {
        setShowEmailModal(false);
      }
    } catch (error) {
      alert("Failed to send advisory: " + error.message)
    }
  }

  const openClientConfigModal = useCallback(async (client) => {
    setConfiguringClient(client)
    setShowConfigModal(true)
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${client.id}/tech`)
      const data = await response.json()
      setClientTechDetails(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch client tech details", error)
      setClientTechDetails([])
    }
  }, [])

  const handleOpenEditModal = (advisory, e) => {
    e.stopPropagation()
    setEditingAdvisory(advisory)
    setEditFormState({ ...advisory })
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingAdvisory(null)
    setEditFormState(null)
  }


  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewAdvisory((prev) => ({ ...prev, [name]: value }))
  }

  const handleCategoryChange = async (e) => {
    const categoryId = parseInt(e.target.value);
    setSelectedCategory(categoryId);
    const res = await fetch(`http://localhost:5000/api/subcategories/${categoryId}`);
    const data = await res.json();
    setSubCategories(data);
    setSelectedSubCategory("");
    setTechStacks([]);
  };


  const handleSubCategoryChange = async (e) => {
    const subcategoryId = parseInt(e.target.value);
    setSelectedSubCategory(subcategoryId);
    const res = await fetch(`http://localhost:5000/api/tech-stacks/${subcategoryId}`);
    const data = await res.json();
    setTechStacks(data);
    setNewAdvisory(prev => ({ ...prev, techStackId: "" }));
  };


  const handleConfigCategoryChange = async (e) => {
    const categoryId = parseInt(e.target.value);
    setSelectedConfigCategory(categoryId);

    const res = await fetch(`http://localhost:5000/api/subcategories/${categoryId}`);
    const data = await res.json();
    setConfigSubCategories(data); // Store full subcategory objects
    setSelectedConfigSubCategory("");
    setTechStacks([]);
  };



  const handleConfigSubCategoryChange = async (e) => {
    const subCategoryId = parseInt(e.target.value);
    setSelectedConfigSubCategory(subCategoryId);

    const res = await fetch(`http://localhost:5000/api/tech-stacks/${subCategoryId}`);
    const data = await res.json();
    setTechStacks(data);
  };




  const handleSubmitAdvisory = async (e) => {
    e.preventDefault()
    const payload = { ...newAdvisory, version: "*" };
    const { techStackId, updateType, description } = payload;

    if (!techStackId || !updateType || !description) {
      alert("Please fill out the basic advisory fields (Tech, Type, Summary).")
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch("http://localhost:5000/api/advisories/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to submit bulk advisory")
      fetchAdvisories()
      alert(result.message)
      setNewAdvisory(initialAdvisoryState)
      setSelectedCategory("")
      setSubCategories([])
      setSelectedSubCategory("")
    } catch (error) {
      console.error("Error submitting bulk advisory:", error)
      alert(error.message)
    } finally {
      setIsLoading(false)
    }
  }





  const handleAddClientTech = async () => {
    if (!newTechStackId && !selectedConfigCategory && !selectedConfigSubCategory) {
      alert("Please select a tech stack, subcategory, or category.");
      return;
    }

    // Get category name from ID
    const selectedCategoryObj = categories.find(cat => cat.id === selectedConfigCategory);
    const categoryName = selectedCategoryObj?.name || null;

    const payload = {
      tech_stack_id: newTechStackId || null,
      subcategory_id: selectedConfigSubCategory || null,
      category_name: categoryName,
      version: "*"
    };



    try {
      const response = await fetch(`http://localhost:5000/api/clients/${configuringClient.id}/tech`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to assign technology.");
      }

      alert("Technology assigned successfully!");


      setNewTechStackId("");
      setSelectedConfigCategory("");
      setConfigSubCategories([]);
      setSelectedConfigSubCategory("");
      setTechStacks([]);


      // Refresh assigned techs
      const data = await fetch(`http://localhost:5000/api/clients/${configuringClient.id}/tech`)
        .then(res => res.json());

      setClientTechDetails(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to assign tech:", error);
      alert("Failed to assign technology.");
    }
  };





  const handleAddCategorySubTech = async (e) => {
    e.preventDefault();

    if (!newCategoryName.trim()) {
      alert("Please enter a category name.");
      return;
    }

    try {
      const categoryRes = await fetch("http://localhost:5000/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      const categoryData = await categoryRes.json();
      if (!categoryRes.ok) throw new Error(categoryData.error || "Failed to add category");

      if (newSubCategoryName.trim()) {
        const subRes = await fetch("http://localhost:5000/api/subcategories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_id: categoryData.id, name: newSubCategoryName }),
        });
        const subData = await subRes.json();
        if (!subRes.ok) throw new Error(subData.error || "Failed to add subcategory");

        if (newTechnologyName.trim()) {
          const techRes = await fetch("http://localhost:5000/api/tech-stacks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subcategory_id: subData.id, name: newTechnologyName }),
          });
          const techData = await techRes.json();
          if (!techRes.ok) throw new Error(techData.error || "Failed to add technology");
        }
      }

      alert("Tech hierarchy added successfully!");
      setNewCategoryName("");
      setNewSubCategoryName("");
      setNewTechnologyName("");
      fetchCategories(); // Refresh dropdowns
    } catch (error) {
      console.error("Error adding tech hierarchy:", error);
      alert(error.message);
    }
  };






  // const handleAddCategory = async (name) => {
  //   const res = await fetch("http://localhost:5000/api/categories", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ name }),
  //   });
  //   const result = await res.json();
  //   alert(result.message || "Category added");
  // };

  // const handleAddSubcategory = async (categoryId, name) => {
  //   const res = await fetch("http://localhost:5000/api/subcategories", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ category_id: categoryId, name }),
  //   });
  //   const result = await res.json();
  //   alert(result.message || "Subcategory added");
  // };






  const handleAddEscalationContact = async (e) => {
    e.preventDefault();
    if (!newEscalationContactEmail.trim() || !newEscalationContactEmail.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${selectedClientId}/escalation-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEscalationContactEmail,
          level: newEscalationContactLevel,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to add contact");
      }

      setNewEscalationContactEmail("");
      fetchEscalationMatrix();
    } catch (error) {
      console.error("Failed to add escalation contact:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeleteEscalationContact = async (contactId) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    try {
      const response = await fetch(`http://localhost:5000/api/escalation-contacts/${contactId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete contact");
      fetchEscalationMatrix();
    } catch (error) {
      console.error("Failed to delete escalation contact:", error);
      alert("Error: Could not delete contact.");
    }
  };


  // const handleAddNewTechStack = async (e) => {
  //   e.preventDefault();
  //   if (!selectedSubCategory || !newTechName.trim()) {
  //     alert("Please select a subcategory and enter a tech name.");
  //     return;
  //   }
  //   try {
  //     const response = await fetch("http://localhost:5000/api/tech-stacks", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ subcategory_id: selectedSubCategory, name: newTechName }),
  //     });
  //     const result = await response.json();
  //     if (!response.ok) throw new Error(result.error);
  //     alert(`Successfully added '${result.name}'`);
  //     setNewTechName("");
  //     fetchTechStacks(selectedSubCategory); // Refresh list
  //   } catch (error) {
  //     alert(error.message);
  //   }
  // };

  const fetchRssFeeds = async (category) => {
    if (!category) {
      setRssFeeds([])
      return
    }
    const techStack = techStacks.find(t => t.name === category);
    if (!techStack) {
      setRssFeeds([]);
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/api/rss-feeds?techStackId=${techStack.id}`)
      const data = await res.json()
      setRssFeeds(data)
    } catch (error) {
      console.error("Error fetching RSS feeds:", error)
    }
  }

  const handleAddRssFeed = async () => {
    if (!selectedFeedCategory || !newRssUrl.trim()) {
      alert("Please select a category and enter a valid RSS URL.")
      return
    }
    const techStack = techStacks.find(t => t.name === selectedFeedCategory);
    if (!techStack) {
      alert("Invalid category selected.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/rss-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tech_stack_id: techStack.id, url: newRssUrl }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Failed to add RSS feed")
      setNewRssUrl("")
      fetchRssFeeds(selectedFeedCategory)
      alert("RSS feed added successfully!")
    } catch (error) {
      console.error("Error adding RSS feed:", error)
      alert(error.message)
    }
  }

  const handleFeedSelection = (e, url) => {
    const newSelection = new Set(feedsToDelete)
    if (e.target.checked) {
      newSelection.add(url)
    } else {
      newSelection.delete(url)
    }
    setFeedsToDelete(newSelection)
  }

  const handleDeleteRssFeeds = async () => {
    if (feedsToDelete.size === 0 || !selectedFeedCategory) {
      alert("No feeds selected or no category specified.")
      return
    }
    const techStack = techStacks.find(t => t.name === selectedFeedCategory);
    if (!techStack) {
      alert("Invalid category selected.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${feedsToDelete.size} feed(s)? This cannot be undone.`)) {
      return
    }
    try {
      const response = await fetch("http://localhost:5000/api/rss-feeds", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tech_stack_id: techStack.id,
          urls: Array.from(feedsToDelete),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to delete feeds")
      alert(result.message)
      setIsDeleteMode(false)
      setFeedsToDelete(new Set())
      fetchRssFeeds(selectedFeedCategory)
    } catch (error) {
      console.error("Error deleting RSS feeds:", error)
      alert(error.message)
    }
  }

  const handleDeleteClientTech = async (tech) => {
    if (!window.confirm("Are you sure you want to delete this tech stack assignment?")) return;
    console.log("Deleting tech:", tech);
    let endpoint = "";
    switch (tech.type?.toLowerCase()) {
      case "tech_stack":
        endpoint = `client-tech/${tech.id}`;
        break;
      case "subcategory":
        endpoint = `client-subcategory/${tech.id}`;
        break;
      case "category":
        endpoint = `client-category/${tech.id}`;
        break;
      default:
        alert("Unknown tech type: " + tech.type);
        return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/${endpoint}`, {
        method: "DELETE",

      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete assignment.");
      alert("Assignment deleted successfully!");
      openClientConfigModal(configuringClient);
    } catch (error) {
      console.error("Failed to delete assignment:", error);
      alert(error.message);
    }
  };

  const handleDeleteAdvisory = async (advisoryId) => {
    if (!window.confirm("Are you sure you want to delete this advisory?")) return

    try {
      const response = await fetch(`http://localhost:5000/api/advisories/${advisoryId}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to delete advisory")
      alert("Advisory deleted successfully.")
      fetchAdvisories()
    } catch (error) {
      console.error("Error deleting advisory:", error)
      alert(error.message)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "Sent":
        return <CheckCircle size={16} className="text-green-600" />
      case "Draft":
        return <Clock size={16} className="text-yellow-600" />
      default:
        return <AlertTriangle size={16} className="text-gray-600" />
    }
  }










  const filteredClients = clients.filter((client) => client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()))
  const selectedClientName = clients.find((c) => c.id === Number(selectedClientId))?.name || ""

  return (
    <div className="advisory-system-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Advisory System</h2>
        </div>

        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "clients" ? "active" : ""}`}
            onClick={() => setActiveTab("clients")}
          >
            <Users size={16} /> Clients
          </button>
          <button
            className={`tab-button ${activeTab === "create" ? "active" : ""}`}
            onClick={() => setActiveTab("create")}
          >
            <FilePlus size={16} /> Create Advisory
          </button>
          <button
            className={`tab-button ${activeTab === "escalation" ? "active" : ""}`}
            onClick={() => setActiveTab("escalation")}
          >
            <ShieldAlert size={16} /> Escalation Matrix
          </button>
        </div>

        {activeTab === "clients" && (
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search clients..."
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        )}


        <div className="tab-content">
          {activeTab === "clients" && (
            <div className="clients-tab">
              <div className="client-list">
                {filteredClients.map((client) => (
                  <div
                    key={`client-${client.id}`}
                    className={`client-item ${selectedClientId === client.id ? "selected" : ""}`}
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <span className="client-name">{client.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openClientConfigModal(client)
                      }}
                      className="client-config-btn"
                      title={`Configure ${client.name}`}
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowTechModal(true)} className="manage-tech-btn" title="Manage Tech Stacks">
                <Tags size={16} /> Manage Tech Stacks
              </button>
            </div>
          )}

          {activeTab === "create" && (
            <div className="create-tab">
              <h3 className="create-title">Create Manual Advisory</h3>
              <form onSubmit={handleSubmitAdvisory} className="advisory-form">

                <div className="form-group">
                  <label className="form-label">Technology Category</label>

                  <select value={selectedCategory} onChange={handleCategoryChange} required>
                    <option value="">-- Select Category --</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>

                </div>

                {subCategories.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Technology Sub-Category</label>

                    <select value={selectedSubCategory} onChange={handleSubCategoryChange} required>
                      <option value="">-- Select Subcategory --</option>
                      {subCategories.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>

                  </div>
                )}

                {subCategories.length > 0 && techStacks.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Technology</label>

                    <select
                      name="techStackId"
                      value={newAdvisory.techStackId}
                      onChange={(e) =>
                        setNewAdvisory((prev) => ({ ...prev, techStackId: e.target.value }))
                      }
                      required
                    >
                      <option value="">-- Select Technology --</option>
                      {techStacks.map((tech) => (
                        <option key={tech.id} value={tech.id}>{tech.name}</option>
                      ))}
                    </select>

                  </div>
                )}


                <div className="form-group">
                  <label className="form-label">Update Type</label>
                  <select
                    name="updateType"
                    value={newAdvisory.updateType}
                    onChange={handleInputChange}
                    required
                    className="form-select"
                  >
                    <option value="">-- Select Update Type --</option>
                    <option value="Security Patch">Security Patch</option>
                    <option value="Vulnerability Alert">Vulnerability Alert</option>
                    <option value="Informational">Informational</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Summary</label>
                  <textarea
                    name="description"
                    placeholder="A brief summary of the advisory..."
                    value={newAdvisory.description}
                    onChange={handleInputChange}
                    rows="3"
                    required
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Vulnerability Details</label>
                  <textarea
                    name="vulnerability_details"
                    placeholder="Details about the vulnerability (one per line)..."
                    value={newAdvisory.vulnerability_details}
                    onChange={handleInputChange}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Technical Analysis</label>
                  <textarea
                    name="technical_analysis"
                    placeholder="Technical analysis of the threat..."
                    value={newAdvisory.technical_analysis}
                    onChange={handleInputChange}
                    rows="4"
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Impact</label>
                  <textarea
                    name="impact_details"
                    placeholder="Potential impact (one per line)..."
                    value={newAdvisory.impact_details}
                    onChange={handleInputChange}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mitigation Strategies</label>
                  <textarea
                    name="mitigation_strategies"
                    placeholder="Mitigation steps (one per line)..."
                    value={newAdvisory.mitigation_strategies}
                    onChange={handleInputChange}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Detection and Response</label>
                  <textarea
                    name="detection_response"
                    placeholder="Detection methods (one per line)..."
                    value={newAdvisory.detection_response}
                    onChange={handleInputChange}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Recommendations</label>
                  <textarea
                    name="recommendations"
                    placeholder="Further recommendations (one per line)..."
                    value={newAdvisory.recommendations}
                    onChange={handleInputChange}
                    rows="3"
                    className="form-textarea"
                  />
                </div>

                <button type="submit" className="submit-btn" disabled={isLoading}>
                  <Send size={18} /> Dispatch Advisory
                </button>
              </form>
            </div>
          )}




          {/* <Link to="/escalation_matrix" className="tab-button">
            <ShieldAlert size={16} /> Escalation Matrix
          </Link> */}



          {activeTab === "escalation" && (
            <div className="escalation-tab">
              <h3 className="create-title">
                Escalation Matrix for {selectedClientName || "..."}
              </h3>
              {!selectedClientId ? (
                <div className="empty-state-small">
                  <p>Please select a client to manage their escalation matrix.</p>
                </div>
              ) : (
                <div className="escalation-matrix">
                  {['L1', 'L2', 'L3'].map(level => (
                    <div key={level} className="escalation-level-card">
                      <h4 className="escalation-level-title">{level} Contacts</h4>
                      <div className="escalation-contacts-list">
                        {escalationContacts[level] && escalationContacts[level].length > 0 ? (
                          escalationContacts[level].map(contact => (
                            <div key={contact.id} className="escalation-contact-item">
                              <span>{contact.email}</span>
                              <button onClick={() => handleDeleteEscalationContact(contact.id)} className="delete-contact-btn">
                                <X size={14} />
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="no-contacts-small">No contacts for this level.</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <form onSubmit={handleAddEscalationContact} className="add-escalation-contact-form">
                    <h4 className="form-title">Add New Contact</h4>
                    <div className="form-row">
                      <input
                        type="email"
                        placeholder="new.contact@email.com"
                        value={newEscalationContactEmail}
                        onChange={(e) => setNewEscalationContactEmail(e.target.value)}
                        className="form-input"
                        required
                      />
                      <select
                        value={newEscalationContactLevel}
                        onChange={(e) => setNewEscalationContactLevel(e.target.value)}
                        className="form-select"
                      >
                        <option value="L1">L1</option>
                        <option value="L2">L2</option>
                        <option value="L3">L3</option>
                      </select>
                      <button type="submit" className="add-contact-btn">Add</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

        </div>
      </aside>

      <main className="main-content">
        <div className="main-header">
          <h1 className="main-title">
            {selectedClientName ? `Advisories for ${selectedClientName}` : "Select a Client"}
          </h1>
        </div>

        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading advisories...</p>
          </div>
        )}

        {!isLoading && advisories.length === 0 && (
          <div className="empty-state">
            <AlertTriangle size={48} className="empty-icon" />
            <p className="empty-text">
              {selectedClientId ? "No advisories found for this client." : "Please select a client to view advisories."}
            </p>
          </div>
        )}

        <div className="advisory-grid">
          {advisories.map((advisory) => (
            <div key={advisory.id} className="advisory-card-enhanced" onClick={() => setViewingAdvisory(advisory)}>
              <div className="advisory-card-header">
                <div className="advisory-title-section">
                  <h3 className="advisory-title">
                    {advisory.update_type === "Advisory"
                      ? "Feed Advisory"
                      : advisory.update_type || "Consolidated Draft"}
                  </h3>
                  <div className="advisory-status">
                    {getStatusIcon(advisory.status)}
                    <span className={`status-text ${advisory.status?.toLowerCase()}`}>
                      {advisory.status || "Unknown"}
                    </span>
                  </div>
                </div>
                {advisory.status === "Draft" && <span className="draft-badge-enhanced">Draft</span>}
              </div>

              <div className="advisory-content">
                <p className="advisory-description">{stripHtml(advisory.description)}</p>
                <div className="advisory-meta">
                  <span className="advisory-date">{new Date(advisory.timestamp).toLocaleDateString()}</span>
                  <span className="advisory-service">{advisory.service_or_os}</span>
                </div>
              </div>

              <div className="advisory-actions">
                {advisory.status === "Draft" && (
                  <button
                    onClick={(e) => handleOpenEditModal(advisory, e)}
                    className="action-btn edit-btn"
                    title="Edit"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openEmailModal(advisory)
                  }}
                  className="action-btn email-btn"
                  title="Email Options"
                >
                  <Mail size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewingAdvisory(advisory)
                  }}
                  className="action-btn view-btn"
                  title="View Details"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteAdvisory(advisory.id)
                  }}
                  className="action-btn delete-btn"
                  title="Delete Advisory"
                >
                  <Delete size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <aside className="rss-sidebar">
        <h2 className="rss-title">Latest News {selectedClientName && `for ${selectedClientName}`}</h2>

        {isRssLoading ? (
          <div className="rss-loading">
            <div className="loading-spinner small"></div>
            <p>Loading news...</p>
          </div>
        ) : rssItems.length === 0 ? (
          <div className="rss-empty">
            <Bell size={32} className="rss-empty-icon" />
            <p className="rss-empty-text">
              {selectedClientId ? "No items found in assigned feeds." : "Select a client to view news."}
            </p>
          </div>
        ) : (
          <div className="rss-items">
            {rssItems.map((item) => (
              <div key={item.id} className="rss-item">
                <a href={item.link} target="_blank" rel="noopener noreferrer" className="rss-item-link">
                  {item.title}
                </a>
                <p className="rss-item-summary">{item.summary}</p>
                <div className="rss-item-meta">
                  <span className="rss-item-date">{new Date(item.published || Date.now()).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleGenerateAiAdvisory(item)}
                    className="ai-generate-btn"
                    disabled={isAiGenerating === item.id}
                  >
                    {isAiGenerating === item.id ? (
                      <div className="loading-spinner-small"></div>
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>{isAiGenerating === item.id ? 'Generating...' : 'Create with AI'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Modals */}
      {viewingAdvisory && <FormattedAdvisoryView advisory={viewingAdvisory} onClose={() => setViewingAdvisory(null)} />}

      {showEmailModal && emailPreview && (
        <div className="modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="modal-content email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Dispatch Advisory: {emailPreview.update_type}</h3>
              <button onClick={() => setShowEmailModal(false)} className="modal-close"><X size={24} /></button>
            </div>
            <div className="email-modal-body">
              <div className="form-group">
                <label className="form-label">Recipients:</label>
                <div className="email-recipients-list">
                  {emailRecipients.length > 0 ? emailRecipients.join(", ") : "Loading recipients..."}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Template:</label>
                <select value={emailTemplate} onChange={(e) => setEmailTemplate(e.target.value)} className="form-select">
                  <option value="standard">Standard</option>
                  <option value="urgent">Urgent</option>
                  <option value="brief">Brief</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subject:</label>
                <input
                  type="text"
                  className="form-input"
                  value={customSubject || generateEmailContent(emailPreview, emailTemplate).subject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Preview:</label>
                <textarea
                  className="form-textarea"
                  rows="8"
                  readOnly
                  value={generateEmailContent(emailPreview, emailTemplate).body}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEmailModal(false)} className="cancel-btn">Cancel</button>
              <button onClick={() => sendAdvisoryEmail(emailPreview, emailTemplate, customSubject)} className="submit-btn">
                <Send size={16} /> Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingAdvisory && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
            {/* Edit Modal Content */}
          </div>
        </div>
      )}

      {showConfigModal && configuringClient && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content config-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Configure Tech for: {configuringClient.name}</h3>
              <button onClick={() => setShowConfigModal(false)} className="modal-close">
                <X size={24} />
              </button>
            </div>
            <section className="config-section">
              <h4 className="config-section-title">Assigned Technologies</h4>
              <div className="tech-assignments">
                {clientTechDetails.length > 0 ? (
                  clientTechDetails.map((tech) => (
                    <div key={tech.id} className="tech-assignment-card">
                      <div className="tech-assignment-header">

                        <h4 className="tech-name">
                          {tech.name || "Unnamed Technology"} <span className="tech-type">({tech.type})</span>
                        </h4>

                        <button
                          onClick={() => handleDeleteClientTech(tech)}
                          className="delete-tech-btn"
                          title="Delete this tech stack"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-tech-assigned">
                    <p>No technologies assigned yet.</p>
                  </div>
                )}
              </div>
            </section>

            <div className="config-divider"></div>

            <section className="config-section">
              <h4 className="config-section-title">Assign New Tech Stack</h4>
              <div className="assign-tech-form">
                <div className="form-group">
                  <label className="form-label">Category</label>

                  <select
                    className="form-select"
                    value={selectedConfigCategory}
                    onChange={handleConfigCategoryChange}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                </div>

                {configSubCategories.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Sub-Category</label>


                    <select
                      className="form-select"
                      value={selectedConfigSubCategory}
                      onChange={handleConfigSubCategoryChange}
                    >
                      <option value="">-- Select Sub-Category --</option>
                      {configSubCategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>


                  </div>
                )}
                {techStacks.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Technology</label>
                    <select
                      className="form-select"
                      value={newTechStackId}
                      onChange={(e) => setNewTechStackId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Technology --</option>
                      {techStacks.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}


                <button onClick={handleAddClientTech} className="assign-btn">
                  <PlusCircle size={16} /> Assign
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {showTechModal && (
        <div className="modal-overlay" onClick={() => setShowTechModal(false)}>
          <div className="modal-content tech-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Manage Tech Stacks & Feeds</h3>
              <button onClick={() => setShowTechModal(false)} className="modal-close">
                <X size={24} />
              </button>
            </div>


            {/* <div className="form-group">
              <label className="form-label">New Category</label>
              <input
                type="text"
                placeholder="e.g., Security"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="form-input"
              />
              <button
                onClick={async () => {
                  await handleAddCategory(newCategoryName);
                  setNewCategoryName("");
                  const updated = await fetch("http://localhost:5000/api/categories");
                  setCategories(await updated.json());
                }}
                className="add-tech-btn"
              >
                <PlusCircle size={16} /> Add Category
              </button>
            </div> */}
            {/* 
            {selectedCategory && (
              <div className="form-group">
                <label className="form-label">New Subcategory</label>
                <input
                  type="text"
                  placeholder="e.g., Firewall"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  className="form-input"
                />
                <button
                  onClick={async () => {
                    await handleAddSubcategory(selectedCategory, newSubcategoryName);
                    setNewSubcategoryName("");
                    const updated = await fetch(`http://localhost:5000/api/subcategories/${selectedCategory}`);
                    setSubCategories(await updated.json());
                  }}
                  className="add-tech-btn"
                >
                  <PlusCircle size={16} /> Add Subcategory
                </button>
              </div>
            )} */}

            <form onSubmit={handleAddCategorySubTech} className="add-tech-hierarchy-form">
              <input
                type="text"
                placeholder="New Category (e.g., Datacenter)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="form-input"
              />
              <input
                type="text"
                placeholder="New Subcategory (optional)"
                value={newSubCategoryName}
                onChange={(e) => setNewSubCategoryName(e.target.value)}
                className="form-input"
              />
              <input
                type="text"
                placeholder="New Technology (optional)"
                value={newTechnologyName}
                onChange={(e) => setNewTechnologyName(e.target.value)}
                className="form-input"
              />
              <button type="submit" className="add-tech-btn">
                <PlusCircle size={16} /> Add Tech Hierarchy
              </button>
            </form>

            <div className="tech-modal-divider"></div>

            <section className="rss-management-section">
              <div className="rss-section-header">
                <h4 className="rss-section-title">Manage RSS Feeds by Category</h4>
                {selectedFeedCategory && rssFeeds.length > 0 && (
                  <button
                    onClick={() => {
                      setIsDeleteMode(!isDeleteMode)
                      setFeedsToDelete(new Set())
                    }}
                    className={`toggle-delete-btn ${isDeleteMode ? "active" : ""}`}
                  >
                    {isDeleteMode ? "Cancel" : "Delete Feeds"}
                  </button>
                )}
              </div>

              <select
                className="form-select tech-select"
                value={selectedFeedCategory}
                onChange={(e) => {
                  const category = e.target.value
                  setSelectedFeedCategory(category)
                  fetchRssFeeds(category)
                  setIsDeleteMode(false)
                  setFeedsToDelete(new Set())
                }}
              >
                <option value="">-- Select Category To Manage Feeds --</option>
                {categories.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <div className="rss-feeds-list">
                {rssFeeds.length > 0 ? (
                  rssFeeds.map((feed, index) => (
                    <div key={index} className="rss-feed-item">
                      {isDeleteMode && (
                        <input
                          type="checkbox"
                          className="feed-checkbox"
                          checked={feedsToDelete.has(feed.url)}
                          onChange={(e) => handleFeedSelection(e, feed.url)}
                        />
                      )}
                      <span className="feed-url">{feed.url}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-feeds">No feeds for this category.</p>
                )}
              </div>

              {isDeleteMode && feedsToDelete.size > 0 && (
                <button onClick={handleDeleteRssFeeds} className="delete-feeds-btn">
                  Delete ({feedsToDelete.size}) Selected Feed(s)
                </button>

              )}

              {!isDeleteMode && (
                <div className="add-rss-form">
                  <input
                    type="text"
                    placeholder="https://example.com/rss"
                    value={newRssUrl}
                    onChange={(e) => setNewRssUrl(e.target.value)}
                    className="form-input"
                  />
                  <button onClick={handleAddRssFeed} className="add-rss-btn">
                    Add URL
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
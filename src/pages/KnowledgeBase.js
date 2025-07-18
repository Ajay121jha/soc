
import React, { useState, useEffect, useRef } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import "../styles/KnowledgeBase.css";

const KnowledgeBase = () => {
  const [query, setQuery] = useState("");
  const [data, setData] = useState([]);
  const [showingSearch, setShowingSearch] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadEntryId, setUploadEntryId] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [sourceType, setSourceType] = useState("Local");
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [newEntry, setNewEntry] = useState({
    ID: "", Title: "", Entity: "", Status: "", Priority: "", Category: "",
    Opening_Date: "", Resolution_Date: "", Last_Updated: "", Last_Edit_By: "",
    Number_of_Documents: "", Assigned_To_Technician: "", Followups_Description: "", Description: ""
  });

  const cache = useRef(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim() !== "") {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [query]);

  const fetchData = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/kb-search");
      const jsonData = await res.json();
      setData(jsonData);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleSearch = async () => {
    const cacheKey = query.trim().toLowerCase();
    if (cache.current.has(cacheKey)) {
      setData(cache.current.get(cacheKey));
    } else {
      try {
        const res = await fetch(`http://localhost:5000/api/kb-search?query=${encodeURIComponent(query)}`);
        const jsonData = await res.json();
        cache.current.set(cacheKey, jsonData);
        setData(jsonData);
      } catch (error) {
        console.error("Search error:", error);
      }
    }
    setShowingSearch(true);
    setCurrentPage(1);
  };

  const handleGoBack = () => {
    setQuery("");
    fetchData();
    setShowingSearch(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:5000/api/kb_table-import", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (res.ok) {
        alert("Import successful!");
        fetchData();
      } else {
        alert("Import failed: " + result.message);
      }
    } catch (error) {
      console.error("Import error:", error);
      alert("Import failed due to a network error.");
    }
    e.target.value = "";
  };

  const handleManualSubmit = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/kb_table-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry),
      });
      if (res.ok) {
        alert("Entry added successfully!");
        setShowForm(false);
        setNewEntry({
          ID: "", Title: "", Entity: "", Status: "", Priority: "", Category: "",
          Opening_Date: "", Resolution_Date: "", Last_Updated: "", Last_Edit_By: "",
          Number_of_Documents: "", Assigned_To_Technician: "", Followups_Description: "", Description: ""
        });
        fetchData();
      } else {
        alert("Failed to add entry");
      }
    } catch (error) {
      console.error("Add error:", error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleCheckbox = (ID) => {
    setSelectedIds((prev) =>
      prev.includes(ID) ? prev.filter((item) => item !== ID) : [...prev, ID]
    );
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      alert("No entries selected.");
      return;
    }

    const confirmDelete = window.confirm("Are you sure you want to delete the selected entries?");
    if (!confirmDelete) return;

    try {
      const res = await fetch("http://localhost:5000/api/kb_table-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ IDs: selectedIds }),
      });

      const result = await res.json();
      if (res.ok) {
        alert("Entries deleted successfully!");
        const updatedRes = await fetch("http://localhost:5000/api/kb-search");
        const updatedData = await updatedRes.json();
        setData(updatedData);
        const minDeletedId = Math.min(...selectedIds);
        const newPage = Math.ceil(minDeletedId / itemsPerPage);
        setCurrentPage(newPage);
        setSelectedIds([]);
        setShowCheckboxes(false);
      } else {
        alert("Delete failed: " + result.message);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed due to a network error.");
    }
  };

  const handleUploadFile = async () => {
    if (!uploadEntryId || !uploadFile) {
      alert("Please enter an entry ID and select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const res = await fetch(`http://localhost:5000/api/upload_solution/${uploadEntryId}`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (res.ok) {
        alert("File uploaded successfully!");
        setShowUploadModal(false);
        setUploadEntryId("");
        setUploadFile(null);
        fetchData();
      } else {
        alert("Upload failed: " + result.error);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed due to a network error.");
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  return (
    <div className="kb-container">
      <div className="kb-card">
        <div className="tool-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search here..."
            className="search-bar"
          />
          <button className="kb-button" onClick={handleSearch}>
            <Search size={16} /> Search
          </button>
          <div className="dropdown">
            <button className="kb-button dropdown-toggle">{sourceType}</button>
            <div className="dropdown-menu">
              <div onClick={() => setSourceType("Local")}>Local</div>
              <div onClick={() => setSourceType("ITSM API")}>ITSM API</div>
            </div>
          </div>
          <label htmlFor="import-file" className="kb-imp">Import Excel</label>
          <input
            type="file"
            id="import-file"
            accept=".xlsx, .csv"
            onChange={handleImport}
            style={{ display: "none" }}
          />
          <button className="kb-button" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> Add Entry
          </button>
          <button className="kb-button" onClick={() => setShowCheckboxes(!showCheckboxes)}>
            <Trash2 size={16} /> {showCheckboxes ? "Cancel Delete" : "Delete Entries"}
          </button>
          {showCheckboxes && (
            <button className="kb-button" onClick={handleDelete}>Confirm Delete</button>
          )}
          <button className="kb-button" onClick={() => setShowUploadModal(true)}>Upload Files</button>
        </div>

        {showForm && (
          <div className="modal-overlay">
            <div className="modal-form">
              <h2>Add New Entry</h2>
              {Object.keys(newEntry).map((key) => (
                <input
                  key={key}
                  type="text"
                  placeholder={key.replace("_", " ")}
                  value={newEntry[key]}
                  onChange={(e) => setNewEntry({ ...newEntry, [key]: e.target.value })}
                  className="kb-input"
                />
              ))}
              <div className="modal-buttons">
                <button className="kb-button" onClick={handleManualSubmit}>Submit</button>
                <button className="kb-button cancel" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {showUploadModal && (
          <div className="modal-overlay">
            <div className="modal-form">
              <h2>Upload Solution File</h2>
              <input
                type="text"
                placeholder="Enter Entry ID"
                value={uploadEntryId}
                onChange={(e) => setUploadEntryId(e.target.value)}
                className="kb-input"
              />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.csv"
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="kb-input"
              />
              <div className="modal-buttons">
                <button className="kb-button" onClick={handleUploadFile}>Upload</button>
                <button className="kb-button cancel" onClick={() => setShowUploadModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <table className="kb-table">
          <thead>
            <tr>
              {showCheckboxes && <th>Select</th>}
              <th>ID</th>
              <th>Title</th>
              <th>Entity</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Category</th>
              <th>Opening Date</th>
              <th>Resolution Date</th>
              <th>Last Updated</th>
              <th>Last edit by</th>
              <th>Assigned To Technician</th>
              <th>Followups - Description</th>
              <th>Description</th>
              <th>Solution</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((item, index) => (
                <tr key={item.ID}>
                  {showCheckboxes && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.ID)}
                        onChange={() => toggleCheckbox(item.ID)}
                      />
                    </td>
                  )}
                  <td>{indexOfFirstItem + index + 1}</td>
                  <td>{item.Title}</td>
                  <td>{item.Entity}</td>
                  <td>{item.Status}</td>
                  <td>{item.Priority}</td>
                  <td>{item.Category}</td>
                  <td>{item.Opening_Date}</td>
                  <td>{item.Resolution_Date}</td>
                  <td>{item.Last_Updated}</td>
                  <td>{item.Last_Edit_By}</td>
                  <td>{item.Assigned_To_Technician}</td>
                  <td>{item.Followups_Description}</td>
                  <td>{item.Description}</td>

                  <td>
                    {item.SolutionFileName ? (
                      <a

                        href={`http://localhost:5000/files/${item.SolutionFileName}`}

                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View File
                      </a>
                    ) : (
                      "No File"
                    )}
                  </td>

                </tr>
              ))
            ) : (
              <tr><td colSpan="15">No results found</td></tr>
            )}
          </tbody>
        </table>

        {data.length > itemsPerPage && (
          <div className="pagination">
            <button className="kb-button" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              ← Previous
            </button>
            <span style={{ margin: "0 10px" }}>Page {currentPage} of {totalPages}</span>
            <button className="kb-button" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
              Next →
            </button>
          </div>
        )}

        {showingSearch && (
          <button className="kb-button kb-back-button" onClick={handleGoBack}>
            ← Back to All Data
          </button>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;

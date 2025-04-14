import React, { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import "../styles/KnowledgeBase.css";

const KnowledgeBase = () => {
  const [query, setQuery] = useState("");
  const [originalData, setOriginalData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [showingSearch, setShowingSearch] = useState(false);
  const cache = useRef(new Map());
  const [selectedOption, setSelectedOption] = useState("Select Action");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const res = await fetch("http://192.168.1.47:5000/api/search?query=");
    const data = await res.json();
    setOriginalData(data);
    setFilteredData(data);
  };

  useEffect(() => {
    const fetchSearch = async () => {
      if (query.trim() === "") {
        setFilteredData(originalData);
        setShowingSearch(false);
        return;
      }

      const lower = query.toLowerCase();
      if (cache.current.has(lower)) {
        setFilteredData(cache.current.get(lower));
      } else {
        const res = await fetch(`http://192.168.1.47:5000/api/search?query=${lower}`);
        const data = await res.json();
        cache.current.set(lower, data);
        setFilteredData(Array.isArray(data) ? data : []);
      }
      setShowingSearch(true);
    };

    fetchSearch();
  }, [query, originalData]);

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:5000/api/import", {
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
  };
  const [showDropdown, setShowDropdown] = useState(false);

  const handleOptionClick = (option) => {
    console.log("Selected:", option);
    setSelectedOption(option);
    setShowDropdown(false);
  };

  const handleGoBack = () => {
    setQuery("");
    setFilteredData(originalData);
    setShowingSearch(false);
  };

  return (
    <div className="kb-container">
      <div className="kb-card">
        <div className="kb-search-bar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by IP, title, email, location..."
            className="kb-input"
          />
          <div className="buttoncon">
            <button className="kb-button">
              <Search size={16} /> Search
            </button>
            <label htmlFor="import-file" className="kb-button">Import</label>
            <input type="file" id="import-file" accept=".xlsx, .csv" onChange={handleImport} style={{ display: "none" }} />

            <div className="dropdown-button-container">
  <button className="dropdown-button" onClick={() => setShowDropdown(!showDropdown)}>
    {selectedOption} <span className="arrow">&#9662;</span>
  </button>
  {showDropdown && (
    <ul className="dropdown-menu">
      <li onClick={() => handleOptionClick('Local DB')}>Local DB</li>
      <li onClick={() => handleOptionClick('ITSM API')}>ITSM API</li>
    </ul>
  )}
</div>


          </div>
        </div>


        <table className="kb-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>IP</th>
              <th>Title</th>
              <th>Status</th>
              <th>Client</th>
              <th>Email</th>
              <th>Location</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.ip_address}</td>
                  <td>{item.title}</td>
                  <td>{item.status}</td>
                  <td>{item.client_name}</td>
                  <td>{item.client_email}</td>
                  <td>{item.client_location}</td>
                  <td>{item.created_at}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>No results found</td>
              </tr>
            )}
          </tbody>
        </table>

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
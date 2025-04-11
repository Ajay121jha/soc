
import { useEffect, useState } from "react";
import axios from "axios";
import { FaFilter } from "react-icons/fa";
import "../styles/OperationRunbook.css";

const OperationRunbooks = () => {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [osFilter, setOsFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    axios.get("http://localhost:5000/api/customers")
      .then(res => setCustomers(res.data))
      .catch(err => console.error("Error:", err));
  }, []);

  const filteredData = customers.filter(cust => {
    const matchesSearch =
      cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.operatingSystem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cust.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesOS = osFilter ? cust.operatingSystem === osFilter : true;
    return matchesSearch && matchesOS;
  });

  return (
    <div className="knowledge-base">
      <div className="kb-card">
        <div className="search-bar-container">
          <input
            type="text"
            placeholder="Search by Name, Email, OS, Location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button className="search-btn">Search</button>
          <button className="filter-btn" onClick={() => setShowFilter(!showFilter)}>
            <FaFilter />
          </button>
        </div>

        {showFilter && (
          <select
            className="filter-dropdown"
            value={osFilter}
            onChange={(e) => setOsFilter(e.target.value)}
          >
            <option value="">All Operating System</option>
            <option value="Windows">Windows</option>
            <option value="Linux">Linux</option>
            <option value="macOS">macOS</option>
          </select>
        )}



        <table className="customer-table">

          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>OS</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((cust, i) => (
              <tr key={i}>
                <td>{cust.name}</td>
                <td>{cust.email}</td>
                <td>{cust.operatingSystem}</td>
                <td>{cust.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OperationRunbooks;
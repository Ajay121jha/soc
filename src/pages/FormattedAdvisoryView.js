import React from 'react';
import '../styles/FormattedAdvisoryView.css';

const FormattedAdvisoryView = ({ advisory, onClose }) => {
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const renderAsList = (text, limit = null) => {
    if (!text || typeof text !== 'string') return <p>Not specified.</p>;
    let items = text.split('\n').filter(item => item.trim());
    if (limit !== null) {
      items = items.slice(0, limit);
    }
    return (
      <ul className="advisory-list">
        {items.map((item, index) => (
          <li key={index}>{item.trim()}</li>
        ))}
      </ul>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content advisory-container" onClick={(e) => e.stopPropagation()}>
        <div className="advisory-header">
          <h2>{`Update: ${advisory.update_type} for ${advisory.service_or_os}`}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="advisory-meta">
          <p><strong>Date:</strong> {formatDate(advisory.timestamp)}</p>
          <p><strong>Category:</strong> {advisory.update_type === 'Vulnerability Alert' ? 'Malware' : 'General'}</p>
          <p><strong>Product:</strong> {advisory.service_or_os}</p>
        </div>

        <div className="advisory-section">
          <h3>Summary</h3>
          <p>{advisory.description || 'No summary provided.'}</p>
        </div>

        <div className="advisory-section">
          <h3>Vulnerability Details</h3>
          {renderAsList(advisory.vulnerability_details)}
        </div>

        <div className="advisory-section">
          <h3>Impact</h3>
          {renderAsList(advisory.impact)}
        </div>

        <div className="advisory-section">
          <h3>Mitigation</h3>
          {renderAsList(advisory.mitigation)}
        </div>

        <div className="advisory-section">
          <h3>Technical Analysis</h3>
          {renderAsList(advisory.technical_analysis, 5)}
        </div>

        <div className="advisory-section">
          <h3>References</h3>
          {renderAsList(advisory.references)}
        </div>
      </div>
    </div>
  );
};

export default FormattedAdvisoryView;

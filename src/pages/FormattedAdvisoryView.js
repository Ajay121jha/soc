import React, { useState, useEffect } from 'react';
import { X, Save, Pencil } from 'lucide-react';
import "../styles/FormattedAdvisoryView.css";

// Helper function to format the timestamp
const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const renderAsList = (text) => {
  if (!text || typeof text !== 'string') return <li>Not specified.</li>;
  if (text.includes('\n')) {
    return text.split('\n').map((item, index) =>
      item.trim() && <li key={index}>- {item.trim()}</li>
    );
  }
  return <li>- {text}</li>;
};

export default function FormattedAdvisoryView({ advisory, onClose, handleSaveEditedAdvisory }) {
  const [editedAdvisory, setEditedAdvisory] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (advisory) {
      setEditedAdvisory({ ...advisory });
      setIsEditing(false); // Reset editing mode when advisory changes
    }
  }, [advisory]);

  if (!editedAdvisory) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedAdvisory((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    handleSaveEditedAdvisory(editedAdvisory);
    onClose();
  };

  const handleCancelEdit = () => {
    setEditedAdvisory({ ...advisory }); // Reset to original data
    setIsEditing(false);
  };

  const isDraft = editedAdvisory.status === "Draft";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content advisory-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>GRANT THORNTON</h2>
          <p>An instinct for growth™</p>
          <button onClick={onClose} className="modal-close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <h1>{`${editedAdvisory.update_type || 'General Update'} for ${editedAdvisory.service_or_os || 'Unknown Service'}`}</h1>
          <div className="meta-info">
            <span><strong>Date:</strong> {formatDate(editedAdvisory.timestamp)}</span>
            <span><strong>Category:</strong> {editedAdvisory.update_type === 'Vulnerability Alert' ? 'Malware' : 'General'}</span>
            <span><strong>Product/Software:</strong> {editedAdvisory.service_or_os}</span>
          </div>

          

          <div className="section">
            <h4>Summary</h4>
            {isDraft && isEditing ? (
              <textarea name="description" value={editedAdvisory.description} onChange={handleChange} />
            ) : (
              <p>{editedAdvisory.description || 'No summary provided.'}</p>
            )}
          </div>

          <div className="section">
            <h4>Vulnerability Details</h4>
            {isDraft && isEditing ? (
              <textarea name="vulnerability_details" value={editedAdvisory.vulnerability_details} onChange={handleChange} />
            ) : (
              <ul>{renderAsList(editedAdvisory.vulnerability_details)}</ul>
            )}
          </div>

          <div className="section">
            <h4>Technical Analysis</h4>
            {isDraft && isEditing ? (
              <textarea name="technical_analysis" value={editedAdvisory.technical_analysis} onChange={handleChange} />
            ) : (
              <p>{editedAdvisory.technical_analysis || 'No technical details available.'}</p>
            )}
          </div>

          <div className="section">
            <h4>Impact</h4>
            {isDraft && isEditing ? (
              <textarea name="impact_details" value={editedAdvisory.impact_details} onChange={handleChange} />
            ) : (
              <ul>{renderAsList(editedAdvisory.impact_details)}</ul>
            )}
          </div>

          <div className="section">
            <h4>Mitigation Strategies</h4>
            {isDraft && isEditing ? (
              <textarea name="mitigation_strategies" value={editedAdvisory.mitigation_strategies} onChange={handleChange} />
            ) : (
              <ul>{renderAsList(editedAdvisory.mitigation_strategies)}</ul>
            )}
          </div>

          <div className="section">
            <h4>Detection and Response</h4>
            {isDraft && isEditing ? (
              <textarea name="detection_response" value={editedAdvisory.detection_response} onChange={handleChange} />
            ) : (
              <ul>{renderAsList(editedAdvisory.detection_response)}</ul>
            )}
          </div>

          <div className="section">
            <h4>Recommendations</h4>
            {isDraft && isEditing ? (
              <textarea name="recommendations" value={editedAdvisory.recommendations} onChange={handleChange} />
            ) : (
              <ul>{renderAsList(editedAdvisory.recommendations)}</ul>
            )}
          </div>
        </div>

        {isDraft && isEditing && (
          <div className="modal-footer">
            <button onClick={handleSave} className="submit-btn">
              <Save size={16} /> Save Changes
            </button>
          </div>
        )}


        {isDraft && !isEditing && (
            <button onClick={() => setIsEditing(true)} className="submit-btn">
              <Pencil size={16} /> Edit Advisory
            </button>
          )}

          {isEditing && (
            <button onClick={handleCancelEdit} className="cancel-btn" style={{ marginTop: '10px' }}>
              ← Back
            </button>
          )}
      </div>
    </div>
  );
}
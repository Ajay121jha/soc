import React from 'react';
import { X } from 'lucide-react';

// Helper function to format the timestamp
const formatDate = (isoString) => {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Helper function to render text with bullet points if it contains newlines
const renderAsList = (text) => {
  if (!text || typeof text !== 'string') {
    return <li>Not specified.</li>;
  }
  // Check if there are newline characters to determine if it should be a list
  if (text.includes('\n')) {
    return text.split('\n').map((item, index) => (
      item.trim() && <li key={index}>{item.trim()}</li>
    ));
  }
  // If no newlines, render as a single paragraph/list item
  return <li>{text}</li>;
};

export default function FormattedAdvisoryView({ advisory, onClose }) {
  if (!advisory) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content !max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-sm font-bold text-blue-700">GRANT THORNTON</h2>
            <p className="text-xs text-gray-500">An instinct for growth™</p>
          </div>
          <button onClick={onClose} className="modal-close-icon">
            <X size={24} />
          </button>
        </div>

        <div className="border-t pt-4 max-h-[80vh] overflow-y-auto pr-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {`${advisory?.update_type || 'General Update'} for ${advisory?.service_or_os || 'Unknown Service'}`}
          </h1>
          <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded-md mb-6 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>Date:</strong> {formatDate(advisory.timestamp)}</span>
            <span>||</span>
            <span><strong>Category:</strong> {
              advisory?.update_type === 'Vulnerability Alert'
                ? 'Malware' : 'General'}</span>
            <span>||</span>
            <span><strong>Product/Software:</strong> {advisory.service_or_os}</span>
          </div>

          {/* Renders each section based on the new data fields */}
          <div className="mb-6">
            <h3 className="section-title">Summary</h3>
            <p className="section-content">{advisory.description || 'No summary provided.'}</p>
          </div>

          <div className="mb-6">
            <h3 className="section-title">Vulnerability Details</h3>
            <ul className="section-content list-disc pl-5 space-y-1">{renderAsList(advisory.vulnerability_details)}</ul>
          </div>

          <div className="mb-6">
            <h3 className="section-title">Technical Analysis</h3>
            <div className="section-content bg-gray-50 p-4 rounded-md font-mono text-sm whitespace-pre-wrap">{advisory.technical_analysis || 'No technical details available.'}</div>
          </div>

          <div className="mb-6">
            <h3 className="section-title">Impact</h3>
            <ul className="section-content list-disc pl-5 space-y-1">{renderAsList(advisory.impact_details)}</ul>
          </div>

          <div className="mb-6">
            <h3 className="section-title">Mitigation Strategies</h3>
            <ul className="section-content list-disc pl-5 space-y-1">{renderAsList(advisory.mitigation_strategies)}</ul>
          </div>

          <div className="mb-6">
            <h3 className="section-title">Detection and Response</h3>
            <ul className="section-content list-disc pl-5 space-y-1">{renderAsList(advisory.detection_response)}</ul>
          </div>

          <div className="mb-6">
            <h3 className="section-title">Recommendations</h3>
            <ul className="section-content list-disc pl-5 space-y-1">{renderAsList(advisory.recommendations)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
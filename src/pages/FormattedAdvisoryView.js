"use client"
import { X, Calendar, Tag, Shield, AlertTriangle, CheckCircle, Eye, FileText } from "lucide-react"
import "../styles/FormattedAdvisoryView.css"

const FormattedAdvisoryView = ({ advisory, onClose }) => {
  const formatDate = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const renderAsList = (text, limit = null) => {
    if (!text || typeof text !== "string") return <p className="no-content">Not specified.</p>
    let items = text.split("\n").filter((item) => item.trim())
    if (limit !== null) {
      items = items.slice(0, limit)
    }
    return (
      <ul className="content-list">
        {items.map((item, index) => (
          <li key={index} className="content-item">
            {item.trim()}
          </li>
        ))}
      </ul>
    )
  }

  const getSeverityIcon = (updateType) => {
    switch (updateType) {
      case "Vulnerability Alert":
        return <AlertTriangle className="severity-icon critical" size={20} />
      case "Security Patch":
        return <Shield className="severity-icon high" size={20} />
      default:
        return <CheckCircle className="severity-icon medium" size={20} />
    }
  }

  const getSeverityClass = (updateType) => {
    switch (updateType) {
      case "Vulnerability Alert":
        return "critical"
      case "Security Patch":
        return "high"
      default:
        return "medium"
    }
  }

  return (
    <div className="advisory-modal-overlay" onClick={onClose}>
      <div className="advisory-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="advisory-modal-header">
          <div className="advisory-header-content">
            <div className="advisory-title-section">
              {getSeverityIcon(advisory.update_type)}
              <div>
                <h2 className="advisory-modal-title">{`${advisory.update_type} for ${advisory.service_or_os}`}</h2>
                <div className={`severity-badge ${getSeverityClass(advisory.update_type)}`}>
                  {advisory.update_type === "Vulnerability Alert"
                    ? "Critical"
                    : advisory.update_type === "Security Patch"
                      ? "High"
                      : "Medium"}{" "}
                  Priority
                </div>
              </div>
            </div>
            <button className="advisory-close-button" onClick={onClose} title="Close">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="advisory-modal-content">
          {/* Meta Information */}
          <div className="advisory-meta-section">
            <div className="meta-grid">
              <div className="meta-item">
                <Calendar size={16} className="meta-icon" />
                <div>
                  <span className="meta-label">Date Issued</span>
                  <span className="meta-value">{formatDate(advisory.timestamp)}</span>
                </div>
              </div>
              <div className="meta-item">
                <Tag size={16} className="meta-icon" />
                <div>
                  <span className="meta-label">Category</span>
                  <span className="meta-value">
                    {advisory.update_type === "Vulnerability Alert" ? "Security Alert" : "System Update"}
                  </span>
                </div>
              </div>
              <div className="meta-item">
                <FileText size={16} className="meta-icon" />
                <div>
                  <span className="meta-label">Affected System</span>
                  <span className="meta-value">{advisory.service_or_os}</span>
                </div>
              </div>
              <div className="meta-item">
                <Eye size={16} className="meta-icon" />
                <div>
                  <span className="meta-label">Status</span>
                  <span className={`meta-value status-${advisory.status?.toLowerCase()}`}>
                    {advisory.status || "Unknown"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="advisory-section">
            <h3 className="section-title">
              <FileText size={18} className="section-icon" />
              Executive Summary
            </h3>
            <div className="section-content">
              <p className="summary-text">{advisory.description || "No summary provided."}</p>
            </div>
          </div>

          {/* Vulnerability Details */}
          {advisory.vulnerability_details && (
            <div className="advisory-section">
              <h3 className="section-title">
                <AlertTriangle size={18} className="section-icon" />
                Vulnerability Details
              </h3>
              <div className="section-content">{renderAsList(advisory.vulnerability_details)}</div>
            </div>
          )}

          {/* Impact Assessment */}
          {advisory.impact_details && (
            <div className="advisory-section">
              <h3 className="section-title">
                <Shield size={18} className="section-icon" />
                Impact Assessment
              </h3>
              <div className="section-content">{renderAsList(advisory.impact_details)}</div>
            </div>
          )}

          {/* Mitigation Strategies */}
          {advisory.mitigation_strategies && (
            <div className="advisory-section">
              <h3 className="section-title">
                <CheckCircle size={18} className="section-icon" />
                Mitigation Strategies
              </h3>
              <div className="section-content">{renderAsList(advisory.mitigation_strategies)}</div>
            </div>
          )}

          {/* Technical Analysis */}
          {advisory.technical_analysis && (
            <div className="advisory-section">
              <h3 className="section-title">
                <FileText size={18} className="section-icon" />
                Technical Analysis
              </h3>
              <div className="section-content">{renderAsList(advisory.technical_analysis, 10)}</div>
            </div>
          )}

          {/* Detection and Response */}
          {advisory.detection_response && (
            <div className="advisory-section">
              <h3 className="section-title">
                <Eye size={18} className="section-icon" />
                Detection and Response
              </h3>
              <div className="section-content">{renderAsList(advisory.detection_response)}</div>
            </div>
          )}

          {/* Additional Recommendations */}
          {advisory.recommendations && (
            <div className="advisory-section">
              <h3 className="section-title">
                <CheckCircle size={18} className="section-icon" />
                Additional Recommendations
              </h3>
              <div className="section-content">{renderAsList(advisory.recommendations)}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="advisory-modal-footer">
          <div className="footer-content">
            <p className="footer-text">
              This advisory was generated on {formatDate(advisory.timestamp)} and should be reviewed regularly for
              updates.
            </p>
            <button className="footer-close-btn" onClick={onClose}>
              Close Advisory
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FormattedAdvisoryView


import React, { useState, useEffect } from "react";
import "../styles/ShiftHandover.css";

function ShiftHandover() {
    const [clusters, setClusters] = useState([]);
    const [users, setUsers] = useState([]);

    const [handoverData, setHandoverData] = useState({
        date: "06 July 2025",
        shift: "Afternoon Shift (2:30 PM to 09:30 PM)",
        cluster: "Cluster 02",
        members: "No Members Found",
        actionPoints: [
            { description: "Keep an eye on various log sources...\n1. moniotor this\n2. monitor that", status: "Informational" },
            { description: "Ticket Delivery Email Address Update", status: "Important" },
            { description: `Going forward please ensure to send all the tickets...`, status: "Important" },
            { description: `SIK - Palo Alto Scan Activity – Daily Reporting Protocol Update...`, status: "Important" },
            { description: `RE Unmanned SOC- Daily Report – 04 July 2025...`, status: "" },
            { description: "CRCSL SE", status: "" },
        ],
        currentShiftPoints: [
            { description: "Keep an eye on Peru log Sources...", status: "Informational" },
            { description: "Ticket Delivery Email Address Update", status: "" },
            { description: `Going forward please ensure to send all the tickets...`, status: "Important" },
            { description: "In RNB, please don’t use any other mailing list...", status: "Important" },
        ],
        lastIncidents: [
            {
                client: "QRadar",
                timings: ["1019372 (POC)", "283869 (Pred One)", "826552 (PROD)"]
            },
            {
                client: "SentinelOne",
                timings: ["", "", ""]
            },
            {
                client: "Seceon",
                subClients: ["Freecharge", "RMSI"],
                severities: [
                    { type: "Major", values: ["-", "07/06/2025, 01:59:06 PM"] },
                    { type: "Minor", values: ["-", "7/6/2025, 07:08:03 PM"] },
                    { type: "System", values: ["-", "-"] },
                    { type: "Critical", values: ["-", "07/06/2025, 04:22:03 PM"] }
                ]
            },
            {
                client: "DLP (Force Point)",
                value: {
                    name: "Orient Electric",
                    timestamp: "2025-07-06 19:45:28"
                }
            }
        ]
    });

    useEffect(() => {
        fetch("http://localhost:5000/api/clusters")
            .then(res => res.json())
            .then(data => {
                setClusters(data);
                if (data.length > 0) {
                    const defaultCluster = `Cluster ${data[0]}`;
                    setHandoverData(prev => ({ ...prev, cluster: defaultCluster }));

                    // Fetch users for default cluster
                    fetch(`http://localhost:5000/api/clusters/${data[0]}`)
                        .then(res => res.json())
                        .then(usersData => {
                            setUsers(usersData);
                            const memberNames = usersData.map(user => user.username).join(", ");
                            setHandoverData(prev => ({ ...prev, members: memberNames }));
                        })
                        .catch(err => console.error("Failed to fetch users:", err));
                }
            })
            .catch(err => console.error("Failed to fetch clusters:", err));
    }, []);


    useEffect(() => {
        const clusterNumber = handoverData.cluster.replace("Cluster ", "");
        if (clusterNumber) {
            fetch(`http://localhost:5000/api/clusters/${clusterNumber}`)
                .then(res => res.json())
                .then(data => {
                    setUsers(data);
                    const memberNames = data.map(user => user.username).join(", ");
                    setHandoverData(prev => ({ ...prev, members: memberNames }));
                })
                .catch(err => console.error("Failed to fetch users:", err));
        }
    }, [handoverData.cluster]);

    const handleCellEdit = (index, field, value) => {
        const updated = [...handoverData.actionPoints];
        updated[index][field] = value;
        setHandoverData({ ...handoverData, actionPoints: updated });
    };

    const handleCurrentCellEdit = (index, field, value) => {
        const updated = [...handoverData.currentShiftPoints];
        updated[index][field] = value;
        setHandoverData({ ...handoverData, currentShiftPoints: updated });
    };

    const handleIncidentEdit = (index, field, value, subIndex = null) => {
        const updatedIncidents = [...handoverData.lastIncidents];
        if (subIndex !== null) {
            if (field === "timing") {
                updatedIncidents[index].timings[subIndex] = value;
            } else if (field === "subClient") {
                updatedIncidents[index].subClients[subIndex] = value;
            } else if (field === "severityType") {
                updatedIncidents[index].severities[subIndex].type = value;
            } else if (field === "severityValue_0") {
                updatedIncidents[index].severities[subIndex].values[0] = value;
            } else if (field === "severityValue_1") {
                updatedIncidents[index].severities[subIndex].values[1] = value;
            }
        } else {
            if (field === "client") {
                updatedIncidents[index].client = value;
            } else if (field === "dlpName") {
                updatedIncidents[index].value.name = value;
            } else if (field === "dlpTimestamp") {
                updatedIncidents[index].value.timestamp = value;
            }
        }
        setHandoverData({ ...handoverData, lastIncidents: updatedIncidents });
    };

    return (
        <div className="handover_wrapper">
            <div className="shift_info">
                <p><strong>Date:</strong>
                    <input
                        type="date"
                        value={handoverData.date}
                        onChange={(e) => setHandoverData({ ...handoverData, date: e.target.value })}
                        className="date_picker"
                    />
                </p>
                <p><strong>Shift:</strong>
                    <select
                        className="shift_picker"
                        value={handoverData.shift}
                        onChange={(e) => setHandoverData({ ...handoverData, shift: e.target.value })}
                    >
                        <option value="Morning">Morning Shift</option>
                        <option value="Afternoon">Afternoon Shift</option>
                        <option value="Night">Night Shift</option>
                        <option value="General">General Shift</option>
                    </select>
                </p>
                <p><strong>Cluster:</strong>
                    <select
                        className="cluster_picker"
                        value={handoverData.cluster}
                        onChange={e => setHandoverData({ ...handoverData, cluster: e.target.value })}
                    >
                        <option value="">Choose a Cluster</option>
                        {clusters.map(cluster => (
                            <option key={cluster} value={`Cluster ${cluster}`}>
                                Cluster {cluster}
                            </option>
                        ))}
                    </select>
                </p>
                <p className="team_members"><strong>Team Members:</strong> {handoverData.members}</p>
            </div>
            <div className="handover_display">
                <div className="disclaimer">
                    <p>
                        ALL INCIDENTS AND REPORTS HAVE BEEN READ OUT AND VALIDATED
                    </p>
                </div>
                {/* Previous Shift Table */}
                <table className="handover_table">
                    <thead>
                        <tr><th colSpan="3">Action Points from Previous Shift</th></tr>
                        <tr><th style={{ justifyContent:"center", width: "10%" }}>S.No.</th><th style={{ width: "75%" }}>Description</th><th style={{ width: "15%" }}>Status</th></tr>
                    </thead>
                    <tbody>
                        {handoverData.actionPoints.map((item, index) => (
                            <tr key={index}>
                                <td style={{ textAlign: "center", verticalAlign: "middle" }}>{index + 1}</td>
                                <td contentEditable suppressContentEditableWarning onBlur={(e) => handleCellEdit(index, "description", e.target.innerText)}>
                                    {item.description}
                                </td>
                                <td
                                    contentEditable
                                    suppressContentEditableWarning
                                    style={{ textAlign: "center", verticalAlign: "middle" }}
                                    className={
                                        item.status.trim().toLowerCase() === "important"
                                            ? "status-important"
                                            : item.status.trim().toLowerCase() === "informational"
                                                ? "status-informational"
                                                : ""
                                    }

                                    onBlur={(e) => handleCellEdit(index, "status", e.target.innerText)}
                                >
                                    {item.status}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* Current Shift Table */}
                <table className="handover_table">
                    <thead>
                        <tr><th colSpan="3">Action Points from Current Shift</th></tr>
                        <tr><th style={{ width: "10%" }}>S.No.</th><th style={{ width: "75%" }}>Description</th><th style={{ width: "15%" }}>Status</th></tr>
                    </thead>
                    <tbody>
                        {handoverData.currentShiftPoints.map((item, index) => (
                            <tr key={index}>
                                <td style={{ textAlign: "center", verticalAlign: "middle" }}>{index + 1}</td>
                                <td contentEditable suppressContentEditableWarning onBlur={(e) => handleCurrentCellEdit(index, "description", e.target.innerText)}>
                                    {item.description}
                                </td>
                                <td
                                    contentEditable
                                    suppressContentEditableWarning
                                    style={{ textAlign: "center", verticalAlign: "middle" }}
                                    className={
                                        item.status.trim().toLowerCase() === "important"
                                            ? "status-important"
                                            : item.status.trim().toLowerCase() === "informational"
                                                ? "status-informational"
                                                : ""
                                    }

                                    onBlur={(e) => handleCurrentCellEdit(index, "status", e.target.innerText)}

                                >
                                    {item.status}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* Last Incident Raised Table */}
                <table className="handover_table">
                    <thead>
                        <tr><th colSpan="7">Last Incident Raised</th></tr>
                        <tr><th>Client</th><th colSpan="6">Timings / Subclients / Details</th></tr>
                    </thead>
                    <tbody>
                        {/* QRadar */}
                        <tr>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(0, "client", e.target.innerText)}>
                                {handoverData.lastIncidents[0].client}
                            </td>
                            <th>POC</th>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(0, "timing", e.target.innerText, 0)}>
                                {handoverData.lastIncidents[0].timings[0]}
                            </td>
                            <th>Pred One</th>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(0, "timing", e.target.innerText, 1)}>
                                {handoverData.lastIncidents[0].timings[1]}
                            </td>
                            <th>PROD</th>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(0, "timing", e.target.innerText, 2)}>
                                {handoverData.lastIncidents[0].timings[2]}
                            </td>
                        </tr>


                        {/* SentinelOne */}
                        <tr>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(1, "client", e.target.innerText)}>
                                {handoverData.lastIncidents[1].client}
                            </td>
                            {handoverData.lastIncidents[1].timings.map((timing, i) => (
                                <td colSpan="2" key={i} contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(1, "timing", e.target.innerText, i)}>
                                    {timing}
                                </td>
                            ))}
                        </tr>

                        {/* Seceon Header Row */}
                        <tr>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(2, "client", e.target.innerText)}>
                                {handoverData.lastIncidents[2].client}
                            </td>
                            <td colSpan="3" contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(2, "subClient", e.target.innerText, 0)}>
                                {handoverData.lastIncidents[2].subClients[0]}
                            </td>
                            <td colSpan="3" contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(2, "subClient", e.target.innerText, 1)}>
                                {handoverData.lastIncidents[2].subClients[1]}
                            </td>
                        </tr>

                        {/* Seceon Severity Rows */}
                        {handoverData.lastIncidents[2].severities.map((severity, i) => (
                            <tr key={i}>
                                <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(2, "severityType", e.target.innerText, i)}>
                                    {severity.type}
                                </td>
                                <td colspan="3" contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(2, "severityValue_0", e.target.innerText, i)}>
                                    {severity.values[0]}
                                </td>
                                <td colSpan="3" contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(2, "severityValue_1", e.target.innerText, i)}>
                                    {severity.values[1]}
                                </td>
                            </tr>
                        ))}

                        {/* DLP Row */}
                        <tr>
                            <td contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(3, "client", e.target.innerText)}>
                                {handoverData.lastIncidents[3].client}
                            </td>
                            <td colSpan="6" style={{ textAlign: "center" }}>
                                <strong contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(3, "dlpName", e.target.innerText)}>
                                    {handoverData.lastIncidents[3].value.name}
                                </strong><br />
                                <span contentEditable suppressContentEditableWarning onBlur={(e) => handleIncidentEdit(3, "dlpTimestamp", e.target.innerText)}>
                                    {handoverData.lastIncidents[3].value.timestamp}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
                {/* Shift Activity Tracker Table */}
                <table className="handover_table">
                    <thead>
                        <tr>
                            <th colSpan="4">
                                Shift Activity Tracker
                            </th>
                        </tr>
                        <tr>
                            <th colSpan="4">
                                Pending from previous Shifts
                            </th>
                        </tr>
                        <tr>
                            <th>Total Pending</th>
                            <th colspan="3">Some of the Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td rowSpan="4" style={{ textAlign: "center" }}>50</td>
                            <td colspan="3">Zscaler ZIA Logs for previous 3 months</td>
                        </tr>
                        <tr>
                            <td colspan="3">Require SOC Playbook</td>
                        </tr>
                        <tr>
                            <td colspan="3">RE: ECLF Audit requirement</td>
                        </tr>
                        <tr>
                            <td colspan="3">CVC Monthly review - May 2025</td>
                        </tr>
                    </tbody>
                    <thead>
                        <tr>
                            <th colSpan="4">
                                Current Shift
                            </th>
                        </tr>
                        <tr>
                            <th>Total Requests Received</th>
                            <th>Resolved</th>
                            <th>Pending</th>
                            <th>Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ textAlign: "center" }}>00</td>
                            <td style={{ textAlign: "center" }}>00</td>
                            <td style={{ textAlign: "center" }}>00</td>
                            <td style={{ textAlign: "center" }}>--</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ShiftHandover;

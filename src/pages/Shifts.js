import React, { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import Modal from "react-modal"; // ✅ Modal added
import { AuthProvider, useAuth } from "../context/AuthContext";
import "../styles/Shifts.css";

// Set modal root for accessibility
Modal.setAppElement("#root");

const Shifts = () => {
  const { user } = useAuth(AuthProvider);
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState(null);
  const [comment, setComment] = useState("");
  const [commentsMap, setCommentsMap] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const sampleShifts = [
      {
        id: 1,
        title: "Morning Shift - A",
        start: "2025-04-07T06:00:00",
        end: "2025-04-07T13:59:59",
        backgroundColor: "#28a745",
        borderColor: "#28a745",
        textColor: "#fff"

      },
      {
        id: 2,
        title: "Afternoon Shift - B",
        start: "2025-04-07T14:00:00",
        end: "2025-04-07T21:59:59",
        backgroundColor: "#ffc107",
        borderColor: "#ffc107",
        textColor: "#fff"

      },
      {
        id: 3,
        title: "Evening Shift - C",
        start: "2025-04-07T22:00:00",
        end: "2025-04-08T05:59:59",
        backgroundColor: "#007bff",
        borderColor: "#007bff",
        textColor: "#fff"

      },
    ];
    setShifts(sampleShifts);
  }, []);

  const handleEventClick = (info) => {
    const shift = info.event;
    setSelectedShift(shift);
    setComment(commentsMap[shift.id] || "");
    setIsModalOpen(true);
  };

  const isWithinShift = () => {
    if (!selectedShift) return false;
    const now = new Date();
    const start = new Date(selectedShift.start);
    const end = new Date(selectedShift.end);
    return now >= start && now <= end;
  };

  const handleSave = () => {
    if (selectedShift) {
      setCommentsMap((prev) => ({
        ...prev,
        [selectedShift.id]: comment,
      }));
    }
    setIsModalOpen(false);
  };

  return (
    <div className="shifts-wrapper">
      <div className="shifts-calendar">
        <FullCalendar
          plugins={[interactionPlugin, dayGridPlugin, timeGridPlugin]}
          allDaySlot={false}
          initialView="timeGridDay"
          slotMinTime={"00:00:00"}
          slotMaxTime={"24:00:00"}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          events={shifts}
          editable={false}
          height="auto"
          eventClick={handleEventClick}
          eventDidMount={(info) => {
            info.el.setAttribute("title", info.event.title);
          }}
        />
      </div>

      {/* ✅ Analyst Comments Modal */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="Analyst Comments"
        className="modal"
        overlayClassName="overlay"
      >
        <h2>Analyst Comments</h2>
        <textarea
          rows={10}
          cols={60}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={!isWithinShift()}
        />
        <div style={{ marginTop: "10px" }}>
          <button
            onClick={handleSave}
            disabled={!isWithinShift()}
            style={{ marginRight: "10px" }}
          >
            Save
          </button>
          <button onClick={() => setIsModalOpen(false)}>Close</button>
        </div>
        {!isWithinShift() && (
          <p style={{ color: "red", marginTop: "10px" }}>
            You can only edit comments during your shift time.
          </p>
        )}
      </Modal>
    </div>
  );
};

export default Shifts;

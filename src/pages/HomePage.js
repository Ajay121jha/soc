import "../styles/HomePage.css";

function HomePage() {
  return (
    <div className="home-container">
      <div className="worm-banner">
        <div className="worm-area">
          {Array.from({ length: 25 }).map((_, i) => (
            <div className="worm" key={i}></div>
          ))}
        </div>
        <h1>Welcome to the SOC Portal</h1>
      </div>

      <div className="main-content">
        {/* The rest of your layout/content goes here */}
        <p>A Legacy of #Exceptional Impact.</p>
      </div>
    </div>
  );
}

export default HomePage;

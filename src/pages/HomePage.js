import React, { useEffect, useRef } from "react";
import "../styles/HomePage.css";

function HomePage() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const el = document.querySelector(".package");

    const updateScale = () => {
      const ratio = window.devicePixelRatio;
      el.style.transform = `translate(-50%, -50%) scale(${1 / ratio})`;
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    const App = {
      canvas: null,
      ctx: null,
      width: 0,
      height: 0,
      particles: [],
      deathCount: 0,
      stepCount: 0,
      drawnInLastFrame: 0,
      animationFrame: null,

      setup: function () {
        const canvas = canvasRef.current;
        const container = canvas.parentElement;

        this.width = container.clientWidth;
        this.height = container.clientHeight;
        canvas.width = this.width;
        canvas.height = this.height;

        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.dataToImageRatio = 1;
        this.ctx.imageSmoothingEnabled = false;
        this.xC = this.width / 2;
        this.yC = this.height / 2;

        this.lifespan = 1000;
        this.popPerBirth = 1;
        this.maxPop = 300;
        this.birthFreq = 5;
        this.gridSize = 8;
        this.gridSteps = Math.floor(1000 / this.gridSize);
        this.grid = [];

        let i = 0;
        const gridArea = 1000;
        const gridRadius = gridArea / 2;
        for (let xx = -gridRadius; xx < gridRadius; xx += this.gridSize) {
          for (let yy = -gridRadius; yy < gridRadius; yy += this.gridSize) {
            const r = Math.sqrt(xx * xx + yy * yy);
            const r0 = 102;
            let field;
            if (r < r0) field = (255 / r0) * r;
            else field = 255 - Math.min(255, (r - r0) / 5);
            this.grid.push({
              x: xx,
              y: yy,
              busyAge: 0,
              spotIndex: i,
              isEdge:
                xx === -gridRadius ||
                xx >= gridRadius - this.gridSize ||
                yy === -gridRadius ||
                yy >= gridRadius - this.gridSize,
              field: field,
            });
            i++;
          }
        }
        this.gridMaxIndex = i;

        this.initDraw();

        const animate = () => {
          this.evolve();
          this.animationFrame = requestAnimationFrame(animate);
        };
        animate();

        // Interactivity: click to spawn
        canvas.addEventListener("click", (e) => {
          const rect = canvas.getBoundingClientRect();
          const baseX = e.clientX - rect.left;
          const baseY = e.clientY - rect.top;

          // Spawn 5 worms with slight random offsets
          for (let i = 0; i < 5; i++) {
            const offsetX = baseX + (Math.random() - 0.5) * 40; // random offset within ±20px
            const offsetY = baseY + (Math.random() - 0.5) * 40;
            this.spawnAt(offsetX, offsetY);
          }
        });
      },

      spawnAt: function (canvasX, canvasY) {
        const x = (canvasX - this.xC) / (1.6 * this.dataToImageRatio);
        const y = (canvasY - this.yC) / (1.6 * this.dataToImageRatio);

        let closestSpot = this.grid[0];
        let minDist = Infinity;
        this.grid.forEach((spot) => {
          const dist = Math.hypot(spot.x - x, spot.y - y);
          if (dist < minDist) {
            minDist = dist;
            closestSpot = spot;
          }
        });

        const particle = {
          hue: 260 + Math.sin(Date.now()) * 5000,
          sat: 60,
          lum: 55,
          x: closestSpot.x,
          y: closestSpot.y,
          xLast: closestSpot.x,
          yLast: closestSpot.y,
          xSpeed: 0,
          ySpeed: 0,
          age: 0,
          ageSinceStuck: 0,
          attractor: {
            oldIndex: closestSpot.spotIndex,
            gridSpotIndex: closestSpot.spotIndex,
          },
          name: "worm-" + Math.ceil(10000000 * Math.random()),
        };
        this.particles.push(particle);
      },

      evolve: function () {
        this.stepCount++;
        this.grid.forEach((e) => {
          if (e.busyAge > 0) e.busyAge++;
        });

        if (
          this.stepCount % this.birthFreq === 0 &&
          this.particles.length + this.popPerBirth < this.maxPop
        ) {
          this.birth();
        }

        this.move();
        this.draw();
      },

      birth: function () {
        const angle = Math.random() * Math.PI * 6;
        const radius = Math.sqrt(Math.random()) * 600;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        let closestSpot = this.grid[0];
        let minDist = Infinity;
        this.grid.forEach((spot) => {
          const dist = Math.hypot(spot.x - x, spot.y - y);
          if (dist < minDist) {
            minDist = dist;
            closestSpot = spot;
          }
        });

        const particle = {
          hue: 260 + Math.sin(Date.now()) * 5000,
          sat: 60,
          lum: 55,
          x: closestSpot.x,
          y: closestSpot.y,
          xLast: closestSpot.x,
          yLast: closestSpot.y,
          xSpeed: 0,
          ySpeed: 0,
          age: 0,
          ageSinceStuck: 0,
          attractor: {
            oldIndex: closestSpot.spotIndex,
            gridSpotIndex: closestSpot.spotIndex,
          },
          name: "worm-" + Math.ceil(10000000 * Math.random()),
        };
        this.particles.push(particle);
      },

      move: function () {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          p.xLast = p.x;
          p.yLast = p.y;

          let index = p.attractor.gridSpotIndex;
          let gridSpot = this.grid[index];

          if (Math.random() < 0.35) {
            if (!gridSpot.isEdge) {
              const neighbors = [
                this.grid[index - 1],
                this.grid[index + 1],
                this.grid[index - this.gridSteps],
                this.grid[index + this.gridSteps],
              ].filter(Boolean);

              if (neighbors.length > 1) {
                const chaos = 3.5;
                const maxFieldSpot = neighbors.reduce((max, spot) =>
                  spot.field + chaos * Math.random() >
                    max.field + chaos * Math.random()
                    ? spot
                    : max
                );

                if (maxFieldSpot.busyAge === 0 || maxFieldSpot.busyAge > 15) {
                  p.ageSinceStuck = 0;
                  p.attractor.oldIndex = index;
                  p.attractor.gridSpotIndex = maxFieldSpot.spotIndex;
                  gridSpot = maxFieldSpot;
                  gridSpot.busyAge = 1;
                } else {
                  p.ageSinceStuck++;
                }
              }

              if (p.ageSinceStuck === 10) {
                this.particles.splice(i, 1);
                i--;
                continue;
              }
            }
          }

          const k = 8,
            visc = 0.4;
          const dx = p.x - gridSpot.x;
          const dy = p.y - gridSpot.y;

          p.xSpeed += -k * dx;
          p.ySpeed += -k * dy;
          p.xSpeed *= visc;
          p.ySpeed *= visc;

          p.x += 0.1 * p.xSpeed;
          p.y += 0.1 * p.ySpeed;
          p.age++;

          if (p.age > this.lifespan) {
            this.particles.splice(i, 1);
            i--;
          }
        }
      },

      draw: function () {
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
        this.ctx.fillRect(0, 0, this.width, this.height);

        for (const p of this.particles) {
          const h = p.hue + this.stepCount / 200;
          const last = this.dataXYtoCanvasXY(p.xLast, p.yLast);
          const now = this.dataXYtoCanvasXY(p.x, p.y);

          this.ctx.beginPath();
          this.ctx.strokeStyle = `hsla(${h}, ${p.sat}%, ${p.lum}%, 1)`;
          this.ctx.moveTo(last.x, last.y);
          this.ctx.lineTo(now.x, now.y);
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();

          const attracSpot = this.grid[p.attractor.gridSpotIndex];
          const attracXY = this.dataXYtoCanvasXY(attracSpot.x, attracSpot.y);
          const oldAttracXY = this.dataXYtoCanvasXY(
            this.grid[p.attractor.oldIndex].x,
            this.grid[p.attractor.oldIndex].y
          );

          this.ctx.beginPath();
          this.ctx.strokeStyle = `hsla(${h}, ${p.sat}%, ${p.lum}%, 0.5)`;
          this.ctx.moveTo(oldAttracXY.x, oldAttracXY.y);
          this.ctx.lineTo(attracXY.x, attracXY.y);
          this.ctx.arc(attracXY.x, attracXY.y, 2.0, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      },

      dataXYtoCanvasXY: function (x, y) {
        const zoom = 1.6;
        return {
          x: this.xC + x * zoom * this.dataToImageRatio,
          y: this.yC + y * zoom * this.dataToImageRatio,
        };
      },

      initDraw: function () {
        this.ctx.fillStyle = "";
        this.ctx.fillRect(0, 0, this.width, this.height);
      },
    };

    App.setup();

    return () => {
      if (App.animationFrame) {
        cancelAnimationFrame(App.animationFrame);
      }
    };
  }, []);

  return (
    <div className="home-container">
      <div className="effect-area">
        <canvas ref={canvasRef} className="particle-canvas" />
        <div className="package">
          <div className="package2">
            <p className="banner">CYBER VIGILANCE CENTRE</p>
            <div className="package-image-wrapper">
              <img src="homepage-logo.png" alt="Company Logo" className="package-image" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

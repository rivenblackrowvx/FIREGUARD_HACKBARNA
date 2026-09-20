import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import './styles.css';
import MapStage from './map/MapStage';
import { AlertBanner, Loader, Rail, Strip } from './components/Shell';
import { FirePanel } from './components/FirePanel';
import { Timeline } from './components/Timeline';
import { DrillFeed } from './components/DrillFeed';
import { CommandCenter, Fires, RiskPage, Simulation, SpreadPage, ValuesPage, WeatherPage } from './pages/Pages';
import { Cameras } from './pages/Cameras';
import { Sources } from './pages/Sources';
import { HardwareOverview, SensorNetwork, HardwareComponents, SoftwareStack, DroneVerification, LiveSignals } from './pages/Hardware';
import { analyze, loadFeeds } from './lib/actions';
import { getState, setState } from './lib/store';

async function boot() {
  await loadFeeds();
  // Score the most intense fires in the background so the map is colour-coded by risk.
  const queue = getState().fires.slice(0, 16);
  const worker = async () => { for (let f = queue.shift(); f; f = queue.shift()) await analyze(f).catch(() => {}); };
  await Promise.all([worker(), worker(), worker(), worker()]);
  setInterval(loadFeeds, 5 * 60_000);
}

function Layout() {
  const { pathname } = useLocation();
  const full = pathname === '/cameras' || pathname === '/sources' || pathname.startsWith('/hardware');
  useEffect(() => {
    if (pathname === '/weather') setState((s) => ({ layers: { ...s.layers, wind: true } }));
    if (pathname === '/simulation') setState({ selectedId: getState().drill.fireId });
  }, [pathname]);
  return (
    <>
      <MapStage />
      <div className="vignette" />
      <Rail />
      <Strip />
      <Routes>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/fires" element={<Fires />} />
        <Route path="/spread" element={<SpreadPage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/values" element={<ValuesPage />} />
        <Route path="/simulation" element={<Simulation />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/hardware" element={<HardwareOverview />} />
        <Route path="/hardware/network" element={<SensorNetwork />} />
        <Route path="/hardware/components" element={<HardwareComponents />} />
        <Route path="/hardware/software" element={<SoftwareStack />} />
        <Route path="/hardware/drone" element={<DroneVerification />} />
        <Route path="/hardware/live" element={<LiveSignals />} />
      </Routes>
      {!full && <FirePanel />}
      {!full && <Timeline />}
      {!full && <DrillFeed />}
      <AlertBanner />
      <Loader />
    </>
  );
}

boot();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  </StrictMode>,
);

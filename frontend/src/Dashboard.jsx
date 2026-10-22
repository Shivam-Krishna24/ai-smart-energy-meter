
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  Zap,
  Gauge,
  IndianRupee,
  LayoutDashboard,
  History,
  Settings,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import api from "./api";

const demoChart = [
  { time: "6 AM", energy: 0.3 },
  { time: "9 AM", energy: 0.7 },
  { time: "12 PM", energy: 1.1 },
  { time: "3 PM", energy: 1.5 },
  { time: "6 PM", energy: 2.1 },
  { time: "9 PM", energy: 2.6 },
];

function MetricCard({ title, value, unit, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <div className={`rounded-xl p-2 ${color}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-slate-900">
        {value}
        <span className="ml-2 text-sm font-normal text-slate-500">
          {unit}
        </span>
      </p>
    </div>
  );
}

export default function Dashboard({ onLogout }) {
  const location = useLocation();
  const [readings, setReadings] = useState([]);
  const [consumption, setConsumption] = useState(null);
  const [meters, setMeters] = useState([]);
  const [selectedMeter, setSelectedMeter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("daily");
  const [periodConsumption, setPeriodConsumption] = useState(null);
  const [showMeterForm, setShowMeterForm] = useState(false);
  const [meterForm, setMeterForm] = useState({
    meterId: "",
    name: "",
    location: "",
  });
  const [registering, setRegistering] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  async function loadMeters() {
    setError("");

    try {
      const response = await api.get("/meters");
      const items = response.data.meters || [];

      setMeters(items);

      if (items.length > 0) {
        setSelectedMeter((current) =>
          items.some((meter) => meter._id === current)
            ? current
            : items[0]._id
        );
      } else {
        setSelectedMeter("");
        setReadings([]);
        setConsumption(null);
      }
    } catch {
      setError(
        "Could not load meters. Check your backend and login token."
      );
    }
  }

  useEffect(() => {
    loadMeters();
  }, []);

  useEffect(() => {
    if (!selectedMeter) return;

    let cancelled = false;

    
async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
        const [readingResponse, consumptionResponse] =
        await Promise.all([
            api.get(`/readings/${selectedMeter}`),
            api.get(
            `/consumption/${selectedMeter}?period=${period}`
            ),
        ]);

        if (cancelled) return;

        setReadings(readingResponse.data.readings || []);
        setPeriodConsumption(consumptionResponse.data);
        setConsumption(consumptionResponse.data);
    } catch (err) {
        if (!cancelled) {
        setError(
            err.response?.data?.message ||
            "Unable to load consumption data."
        );
        }
    } finally {
        if (!cancelled) setLoading(false);
    }
    }

    loadDashboard();

    const refreshTimer = setInterval(() => {
      loadDashboard();
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
    };
  }, [selectedMeter, period]);
  
  useEffect(() => {
    if (!selectedMeter) {
      setForecast(null);
      setForecastError("");
      return;
    }

    let cancelled = false;

    async function loadForecast() {
      setForecastLoading(true);
      setForecastError("");

      try {
        const response = await api.get(`/forecast/${selectedMeter}`);

        if (!cancelled) {
          setForecast(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          setForecast(null);
          setForecastError(
            error.response?.data?.message ||
              "Unable to load energy forecast."
          );
        }
      } finally {
        if (!cancelled) {
          setForecastLoading(false);
        }
      }
    }

    loadForecast();

    return () => {
      cancelled = true;
    };
  }, [selectedMeter]);


  const latest = readings[0];

  const chartData = [...readings]
    .reverse()
    .map((reading) => ({
      time: new Date(reading.measuredAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      energy: reading.energy,
    }));

  
  const handleRegisterMeter = async (e) => {
    e.preventDefault();
    setRegistering(true);
    setFormMessage("");

    const newMeterId = meterForm.meterId.trim();

    try {
      await api.post("/meters", {
        ...meterForm,
        meterId: newMeterId,
      });

      const response = await api.get("/meters");
      const registeredMeters = response.data.meters || [];

      setMeters(registeredMeters);

      const newMeter = registeredMeters.find(
        (meter) => meter.meterId === newMeterId
      );

      if (newMeter) {
        setSelectedMeter(newMeter._id);
      }

      setMeterForm({
        meterId: "",
        name: "",
        location: "",
      });

      setShowMeterForm(false);
      setFormMessage("Meter registered successfully!");
    } catch (error) {
      setFormMessage(
        error.response?.data?.message ||
          "Failed to register meter."
      );
    } finally {
      setRegistering(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-6 md:block">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-600 p-2 text-white">
              <Zap size={24} />
            </div>
            <div>
              <h1 className="font-bold">EnergyWise</h1>
              <p className="text-xs text-slate-500">Smart Energy Meter</p>
            </div>
          </div>

          <nav className="mt-10 space-y-2">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl p-3 font-medium ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`
              }
            >
              <LayoutDashboard size={19} />
              Dashboard
            </NavLink>

            <NavLink
              to="/consumption"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl p-3 font-medium ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`
              }
            >
              <History size={19} />
              Consumption
            </NavLink>

            <NavLink
              to="/forecast"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl p-3 font-medium ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`
              }
            >
              <Activity size={19} />
              AI Forecast
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl p-3 font-medium ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`
              }
            >
              <Settings size={19} />
              Settings
            </NavLink>
          </nav>

          <div className="mt-12 rounded-2xl bg-slate-900 p-4 text-white">
            <Zap className="mb-3 text-emerald-400" size={24} />
            <p className="font-semibold">Save more energy</p>
            <p className="mt-2 text-sm text-slate-300">
              Monitor your consumption to make informed decisions.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-5 md:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">
                Smart Energy Management
              </p>
              <h2 className="mt-1 text-2xl font-bold md:text-3xl">
                Energy Dashboard
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Monitor your electricity usage in one place.
              </p>
            </div>

            <button
              onClick={loadMeters}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-100"
            >
              <RefreshCw size={17} />
              Refresh meters
            </button>
            <button
            onClick={onLogout}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700"
            >
            Log out
            </button>
          </header>

          <div className="mb-6">
            <button
              onClick={() => {
                setShowMeterForm(!showMeterForm);
                setFormMessage("");
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              {showMeterForm ? "Cancel" : "+ Register Meter"}
            </button>

            {formMessage && (
              <p className="mt-3 text-sm">{formMessage}</p>
            )}

            {showMeterForm && (
              <form
                onSubmit={handleRegisterMeter}
                className="mt-4 max-w-lg space-y-4 rounded-xl border p-5"
              >
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Meter ID
                  </label>
                  <input
                    required
                    value={meterForm.meterId}
                    onChange={(e) =>
                      setMeterForm({
                        ...meterForm,
                        meterId: e.target.value,
                      })
                    }
                    placeholder="e.g. METER002"
                    className="w-full rounded-lg border p-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Meter Name
                  </label>
                  <input
                    required
                    value={meterForm.name}
                    onChange={(e) =>
                      setMeterForm({
                        ...meterForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g. Office Energy Meter"
                    className="w-full rounded-lg border p-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Location
                  </label>
                  <input
                    value={meterForm.location}
                    onChange={(e) =>
                      setMeterForm({
                        ...meterForm,
                        location: e.target.value,
                      })
                    }
                    placeholder="e.g. First Floor"
                    className="w-full rounded-lg border p-2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={registering}
                  className="rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50"
                >
                  {registering ? "Registering..." : "Register Meter"}
                </button>
              </form>
            )}
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={20} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
            <label className="mb-2 block text-sm font-medium">
              Select your meter
            </label>
            <select
              value={selectedMeter}
              onChange={(event) => setSelectedMeter(event.target.value)}
              className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
            >
              <option value="">Choose a registered meter</option>
              {meters.map((meter) => (
                <option key={meter._id} value={meter._id}>
                  {meter.name} ({meter.meterId})
                </option>
              ))}
            </select>

            {!meters.length && (
              <p className="mt-3 text-sm text-slate-500">
                No meters found. Register a meter through the authenticated API first.
              </p>
            )}
          </section>

          {location.pathname === "/dashboard" &&(
          <section className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Voltage"
              value={latest ? latest.voltage : "--"}
              unit="V"
              icon={Zap}
              color="bg-amber-50 text-amber-600"
            />
            <MetricCard
              title="Current"
              value={latest ? latest.current : "--"}
              unit="A"
              icon={Activity}
              color="bg-blue-50 text-blue-600"
            />
            <MetricCard
              title="Power"
              value={latest ? latest.power : "--"}
              unit="W"
              icon={Gauge}
              color="bg-purple-50 text-purple-600"
            />
            <MetricCard
              title="Cumulative Energy"
              value={latest ? latest.energy : "--"}
              unit="kWh"
              icon={Zap}
              color="bg-emerald-50 text-emerald-600"
            />
          </section>)}

          {location.pathname === "/consumption" &&(
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Energy Reading History</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Recorded cumulative energy values
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {readings.length} readings
                </span>
              </div>

              <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="energyGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="energy"
                      name="Energy (kWh)"
                      stroke="#059669"
                      fill="url(#energyGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {!chartData.length && (
                <p className="text-sm text-slate-500">
                  No readings available for this meter yet.
                </p>
              )}
            </div>
            
            <div className="mb-4 flex gap-2">
            <button
                onClick={() => setPeriod("daily")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                period === "daily"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
            >
                Daily
            </button>

            <button
                onClick={() => setPeriod("monthly")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                period === "monthly"
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
            >
                Monthly
            </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold">
                {period === "daily" ? "Today's Summary" : "This Month's Summary"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Consumption and estimated cost
              </p>

              <div className="mt-6 rounded-xl bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  Energy consumed
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-900">
                  {consumption?.consumptionKWh ?? "--"}
                  <span className="ml-2 text-sm font-normal">kWh</span>
                </p>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <IndianRupee className="text-slate-500" size={22} />
                <div>
                  <p className="text-sm text-slate-500">
                    Estimated energy charge
                  </p>
                  <p className="text-xl font-bold">
                    {consumption
                      ? `₹${consumption.estimatedBill}`
                      : "--"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                {loading
                  ? "Updating readings..."
                  : "Cost is an estimate based on the configured rate, not an official bill."}
              </p>
            </div>
          </section>)}  
          {location.pathname === "/forecast" &&(
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <h3 className="text-xl font-bold">AI Energy Demand Forecast</h3>
              <p className="mt-1 text-sm text-slate-500">
                Predicted electricity consumption for the next seven days.
              </p>
            </div>

            {forecastLoading && (
              <p className="mt-5 text-sm text-slate-500">
                Generating energy forecast...
              </p>
            )}

            {forecastError && (
              <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {forecastError}
              </div>
            )}

            {!forecastLoading && !forecastError && forecast && (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">
                      Predicted 7-day consumption
                    </p>
                    <p className="mt-2 text-3xl font-bold text-emerald-900">
                      {Number(forecast.predicted7DayKWh).toFixed(3)} kWh
                    </p>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-4">
                    <p className="text-sm text-blue-800">
                      Forecasting method
                    </p>
                    <p className="mt-2 font-semibold text-blue-900">
                      {forecast.model}
                    </p>
                    <p className="mt-1 text-sm text-blue-800">
                      {forecast.mlModelTrained
                        ? "Random Forest model trained"
                        : "Baseline estimate — more history needed"}
                    </p>
                  </div>
                </div>

                {forecast.message && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    {forecast.message}
                  </p>
                )}

                <div className="mt-6 h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(forecast.forecast || []).map((item) => ({
                        date: item.date,
                        predictedKWh: item.predictedKWh,
                      }))}
                      margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        label={{
                          value: "Energy (kWh)",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${Number(value).toFixed(4)} kWh`,
                          "Predicted consumption",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="predictedKWh"
                        name="Predicted consumption"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {forecast.mlModelTrained && forecast.evaluation && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">
                        Mean Absolute Error (MAE)
                      </p>
                      <p className="mt-2 text-xl font-bold">
                        {Number(forecast.evaluation.maeKWh).toFixed(4)} kWh
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">
                        Root Mean Squared Error (RMSE)
                      </p>
                      <p className="mt-2 text-xl font-bold">
                        {Number(forecast.evaluation.rmseKWh).toFixed(4)} kWh
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>)}
          {location.pathname === "/settings" && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-xl font-bold">Settings</h3>
              <p className="mt-2 text-sm text-slate-500">
                Manage your registered energy meters.
              </p>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="font-medium">Registered meters</p>
                <p className="mt-1 text-sm text-slate-500">
                  {meters.length} meter(s) registered
                </p>
              </div>

              <button
                onClick={() => {
                  setShowMeterForm(true);
                  setFormMessage("");
                }}
                className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Register a meter
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

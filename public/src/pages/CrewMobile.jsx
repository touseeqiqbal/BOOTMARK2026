import { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';
import { MapPin, Navigation, Battery, Clock, CheckCircle, AlertCircle, Play, Pause } from 'lucide-react';
import GPSTrackingMap from '../components/GPSTrackingMap';

export default function CrewMobile() {
    const { user } = useAuth();
    const [tracking, setTracking] = useState(false);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [locationError, setLocationError] = useState('');
    const [watchId, setWatchId] = useState(null);
    const [battery, setBattery] = useState(null);
    const [speed, setSpeed] = useState(0);
    const [heading, setHeading] = useState(0);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [updateCount, setUpdateCount] = useState(0);
    const [jobs, setJobs] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(true);

    // Get battery level
    useEffect(() => {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                setBattery(Math.round(battery.level * 100));
                battery.addEventListener('levelchange', () => {
                    setBattery(Math.round(battery.level * 100));
                });
            });
        }
    }, []);

    // Start GPS tracking
    const startTracking = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        const id = navigator.geolocation.watchPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    speed: position.coords.speed || 0,
                    heading: position.coords.heading || 0
                };

                setCurrentLocation(location);
                setSpeed(location.speed * 3.6); // Convert m/s to km/h
                setHeading(location.heading);
                setLocationError('');

                // Send location to server
                updateLocationOnServer(location);
            },
            (error) => {
                setLocationError(error.message);
                console.error('GPS Error:', error);
            },
            options
        );

        setWatchId(id);
        setTracking(true);
    };

    // Stop GPS tracking
    const stopTracking = () => {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            setWatchId(null);
        }
        setTracking(false);
    };

    // Update location on server
    const updateLocationOnServer = async (location) => {
        try {
            await api.post(`/gps/${user.uid}/location`, {
                lat: location.lat,
                lng: location.lng,
                accuracy: location.accuracy,
                speed: location.speed,
                heading: location.heading,
                battery: battery,
                timestamp: new Date().toISOString()
            });

            setLastUpdate(new Date());
            setUpdateCount(prev => prev + 1);
        } catch (error) {
            console.error('Failed to update location:', error);
        }
    };

    // Fetch jobs on mount
    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            setLoadingJobs(true);
            const res = await api.get('/work-orders/assigned');
            setJobs(res.data);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        } finally {
            setLoadingJobs(false);
        }
    };

    const updateJobStatus = async (jobId, newStatus) => {
        try {
            await api.patch(`/work-orders/${jobId}/status`, { status: newStatus });
            // Refresh jobs
            fetchJobs();

            // If clocking in, ensure GPS tracking is on
            if (newStatus === 'in_progress' && !tracking) {
                startTracking();
            }
        } catch (error) {
            console.error('Failed to update job status:', error);
            alert('Failed to update status. Please try again.');
        }
    };

    // Auto-start tracking on mount (if already in a session, maybe?)
    // Actually, manual start might be better for battery, but let's keep it for now
    useEffect(() => {
        // startTracking(); // Commenting out auto-start to give control to user
        return () => {
            if (watchId) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, []);

    const formatTime = (date) => {
        if (!date) return 'Never';
        return date.toLocaleTimeString();
    };

    return (
        <div className="crew-mobile">
            <div className="crew-mobile-header">
                <h1>Field Ops</h1>
                <p>Welcome, {user?.displayName || 'Crew Member'}</p>
            </div>

            {/* Job Schedule */}
            <div className="job-schedule">
                <h2><Clock size={20} /> Today's Schedule</h2>
                {loadingJobs ? (
                    <div className="loading">Loading assignments...</div>
                ) : jobs.length === 0 ? (
                    <div className="info-box">
                        <AlertCircle size={20} color="#9ca3af" />
                        <div className="info-content">
                            <div className="info-label">Current Status</div>
                            <div className="info-value">No Jobs Assigned</div>
                            <div className="info-sub">Check back later or contact dispatch</div>
                        </div>
                    </div>
                ) : (
                    <div className="job-list">
                        {jobs.map(job => (
                            <div key={job.id} className={`job-card ${job.status === 'in_progress' ? 'in-progress' : ''} ${job.status === 'completed' ? 'completed' : ''}`}>
                                <div className="job-header">
                                    <h3 className="job-title">{job.title || 'Untitled Job'}</h3>
                                    <span className={`job-status-badge ${job.status}`}>
                                        {job.status?.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="job-details">
                                    <div className="job-detail-item">
                                        <MapPin size={14} />
                                        <span>{job.address || 'No address provided'}</span>
                                    </div>
                                    <div className="job-detail-item">
                                        <Clock size={14} />
                                        <span>Scheduled: {job.scheduledDate ? new Date(job.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Asap'}</span>
                                    </div>
                                </div>
                                <div className="job-actions">
                                    {job.status !== 'completed' && job.status !== 'in_progress' && (
                                        <button
                                            className="job-btn job-btn-primary"
                                            onClick={() => updateJobStatus(job.id, 'in_progress')}
                                        >
                                            <Play size={16} /> CLOCK IN
                                        </button>
                                    )}
                                    {job.status === 'in_progress' && (
                                        <button
                                            className="job-btn job-btn-success"
                                            onClick={() => updateJobStatus(job.id, 'completed')}
                                        >
                                            <CheckCircle size={16} /> CLOCK OUT / FINISH
                                        </button>
                                    )}
                                    {job.status === 'completed' && (
                                        <div className="job-btn job-btn-disabled">
                                            <CheckCircle size={16} /> COMPLETED
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Status Card */}
            <div className="status-card">
                <div className="status-indicator">
                    {tracking ? (
                        <>
                            <CheckCircle size={24} color="#10b981" />
                            <span className="status-text active">Tracking Active</span>
                        </>
                    ) : (
                        <>
                            <AlertCircle size={24} color="#ef4444" />
                            <span className="status-text inactive">Tracking Stopped</span>
                        </>
                    )}
                </div>

                <button
                    className={`tracking-btn ${tracking ? 'stop' : 'start'}`}
                    onClick={tracking ? stopTracking : startTracking}
                >
                    {tracking ? (
                        <>
                            <Pause size={20} />
                            Stop Tracking
                        </>
                    ) : (
                        <>
                            <Play size={20} />
                            Start Tracking
                        </>
                    )}
                </button>
            </div>

            {locationError && (
                <div className="alert alert-error">
                    <AlertCircle size={20} />
                    {locationError}
                </div>
            )}

            {/* Location Info */}
            {currentLocation && (
                <div className="location-info-grid">
                    <div className="info-box">
                        <MapPin size={24} color="#3b82f6" />
                        <div className="info-content">
                            <div className="info-label">Location</div>
                            <div className="info-value">
                                {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                            </div>
                            <div className="info-sub">
                                Accuracy: ±{Math.round(currentLocation.accuracy)}m
                            </div>
                        </div>
                    </div>

                    <div className="info-box">
                        <Navigation size={24} color="#10b981" />
                        <div className="info-content">
                            <div className="info-label">Speed</div>
                            <div className="info-value">{Math.round(speed)} km/h</div>
                            <div className="info-sub">
                                Heading: {Math.round(heading)}°
                            </div>
                        </div>
                    </div>

                    {battery !== null && (
                        <div className="info-box">
                            <Battery size={24} color={battery > 20 ? '#10b981' : '#ef4444'} />
                            <div className="info-content">
                                <div className="info-label">Battery</div>
                                <div className="info-value">{battery}%</div>
                                <div className="info-sub">
                                    {battery > 20 ? 'Good' : 'Low'}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="info-box">
                        <Clock size={24} color="#f59e0b" />
                        <div className="info-content">
                            <div className="info-label">Last Update</div>
                            <div className="info-value">{formatTime(lastUpdate)}</div>
                            <div className="info-sub">
                                {updateCount} updates sent
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Map */}
            {currentLocation && (
                <div className="crew-map-container">
                    <GPSTrackingMap
                        employees={[{
                            id: user.uid,
                            name: user.displayName || 'You',
                            lat: currentLocation.lat,
                            lng: currentLocation.lng,
                            status: 'active',
                            speed: speed,
                            heading: heading,
                            battery: battery,
                            lastUpdate: lastUpdate?.toISOString()
                        }]}
                        center={[currentLocation.lat, currentLocation.lng]}
                        zoom={15}
                    />
                </div>
            )}

            {/* Instructions */}
            <div className="instructions-card">
                <h3>Instructions</h3>
                <ul>
                    <li>Keep this page open while working</li>
                    <li>Your location updates automatically every few seconds</li>
                    <li>Make sure location services are enabled</li>
                    <li>Keep your device charged for best accuracy</li>
                </ul>
            </div>
        </div>
    );
}

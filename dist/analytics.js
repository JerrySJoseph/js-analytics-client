//Analytics engine client side
const $d3928351bb4a0237$var$isDev = window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1");
const $d3928351bb4a0237$var$log = $d3928351bb4a0237$var$isDev ? console.log : ()=>{};
const $d3928351bb4a0237$var$error = $d3928351bb4a0237$var$isDev ? console.error : ()=>{};
function $d3928351bb4a0237$var$init(window1, document1) {
    // Check if a global config object is defined
    const config = window1.analyticsConfig || {};
    const API_BASE_URL = config.apiBaseUrl || `${!$d3928351bb4a0237$var$isDev ? "https://analytics.jscloud.in" : "http://localhost:3000"}/api/v1`;
    const PROJECT_ID = !$d3928351bb4a0237$var$isDev ? config.projectId : "670cfd5967d53bf2459c535e";
    const ACTIVITY_TRACKING_TIMEOUT = config.activityTrackingTimeout || (!$d3928351bb4a0237$var$isDev ? 900000 /*15 mins */  : 300000 /* 5mins*/ );
    if (!PROJECT_ID) throw new Error("No project-id specified. Please specify Project id in the global config.");
    /******************************** HELPER Fns *********************************** */ // Helper function to send POST/PUT requests
    const apiRequest = async (url, method, data)=>{
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error("API request failed");
            return await response.json();
        } catch (err) {
            $d3928351bb4a0237$var$error("Session Tracker API Error:", err);
        }
    };
    /**************************** HELPER Fn END **************************************/ /************************ Activity Tracking *********************************** */ let activityTimeout;
    const resetActivityTimer = ()=>{
        if (activityTimeout) clearTimeout(activityTimeout);
        activityTimeout = setTimeout(async ()=>{
            await endSession();
        }, ACTIVITY_TRACKING_TIMEOUT); // End session after inactivity
    };
    const trackUserActivity = ()=>{
        [
            "mousemove",
            "keydown",
            "scroll",
            "click"
        ].forEach((eventType)=>{
            window1.addEventListener(eventType, resetActivityTimer);
        });
    };
    // Start tracking activity when the session starts
    trackUserActivity();
    /************************ Activity Tracking END *********************************** */ /************************* EVENT LOGGING ******************************************* */ let eventQueue = [];
    const BATCH_SIZE = config.eventBatchSize || 10;
    const BATCH_INTERVAL = config.eventBatchInterval || 10000; // 10s
    // Function to log individual events
    const logEvent = (event)=>{
        eventQueue.push(event);
        $d3928351bb4a0237$var$log("Logged event", event);
        if (eventQueue.length >= BATCH_SIZE) flushEvents();
    };
    // Function to send batched events
    const flushEvents = async ()=>{
        if (eventQueue.length === 0) return;
        // Send events in a single request
        $d3928351bb4a0237$var$log(`Flushing ${eventQueue.length} events.`);
        const url = `${API_BASE_URL}/events/log`;
        const result = await apiRequest(url, "POST", {
            events: eventQueue
        });
        if (result && result.success) // Clear the queue
        eventQueue = [];
    };
    setInterval(flushEvents, BATCH_INTERVAL);
    /************************ SESSION MANAGEMENT *************************************** */ let sessionId = null;
    // Function to create a new session
    const createSession = async ()=>{
        if (sessionId) return;
        const sessionData = {
            visitorId: getVisitorId(),
            project: PROJECT_ID,
            referrer: document1.referrer || "Direct",
            pageUrl: window1.location.pathname,
            pageTitle: document1.title,
            userAgent: navigator.userAgent
        };
        const result = await apiRequest(`${API_BASE_URL}/session/create`, "POST", sessionData);
        if (result && result.sessionId) {
            sessionId = result.sessionId;
            //saveSessionId(sessionId);
            resetActivityTimer();
        }
    };
    // Function to update session (e.g., page view)
    const updateSession = async ()=>{
        if (!sessionId) return createSession();
        const updateData = {
            exitPage: window1.location.pathname,
            pageUrl: window1.location.pathname,
            pageTitle: document1.title,
            referrer: document1.referrer || "Direct"
        };
        await apiRequest(`${API_BASE_URL}/session/update/${sessionId}`, "PUT", updateData);
    };
    // Function to end session
    const endSession = async ()=>{
        if (!sessionId) return;
        const url = `${API_BASE_URL}/session/end/${sessionId}`;
        const data = {
            events: eventQueue
        };
        // Use navigator.sendBeacon to send the session end data
        if (navigator.sendBeacon) {
            const blob = new Blob([
                JSON.stringify(data)
            ], {
                type: "application/json"
            });
            navigator.sendBeacon(url, blob);
        } else apiRequest(`${API_BASE_URL}/session/end/${sessionId}`, "POST", data);
        sessionId = null;
    //clearSessionId();
    };
    // Helper to generate visitor ID (could be from cookie/localStorage)
    const getVisitorId = ()=>{
        let visitorId = localStorage.getItem("visitorId");
        if (!visitorId) {
            visitorId = "visitor-" + Math.random().toString(36).substr(2, 9);
            localStorage.setItem("visitorId", visitorId);
        }
        return visitorId;
    };
    // determine if the log for this element is required
    const isRelevantElement = (element)=>{
        const tagName = element.tagName.toLowerCase();
        // Check if the element has data-analytics="true" attribute
        const isMarkedForAnalytics = element.getAttribute("data-analytics") === "true";
        // Track marked elements & other relevant elements: buttons, links, inputs, and form submissions
        return isMarkedForAnalytics || tagName === "button" || tagName === "a" || tagName === "input" && (element.type === "submit" || element.type === "button");
    };
    // Handle session start and end on page load/unload
    const handlePageLoad = async ()=>{
        //sessionId = retrieveSessionId();
        if (!sessionId) await createSession();
        else await updateSession();
    };
    const handleVisibilityChange = async ()=>{
        // if (document.visibilityState === 'hidden')
        //     await endSession();
        //sessionId = retrieveSessionId();
        if (document1.visibilityState === "visible" && !sessionId) await createSession();
    };
    const handleDocumentClick = async (ev)=>{
        let element = ev.target;
        if (!element || !sessionId) return;
        const tagName = element.tagName.toLowerCase();
        // fix for fa-icons wrapped in i tag
        if (tagName && tagName === "i" && element.parentElement) element = element.parentElement;
        // skip logging for irrelevant elements
        if (!isRelevantElement(element)) return;
        const eventName = element.getAttribute("data-event-name") || "Unnamed Click Event";
        const eventType = element.getAttribute("data-event-type") || "click";
        const eventData = {
            visitorId: getVisitorId(),
            session: sessionId,
            project: PROJECT_ID,
            eventType: eventType,
            eventName: eventName,
            eventTarget: element.id || element.name || "unnamed element",
            elementType: element.tagName.toLowerCase(),
            eventAttributes: {
                innerText: element.innerText,
                value: element.value
            }
        };
        logEvent(eventData);
    };
    const handleBeforeUnload = async ()=>{
        $d3928351bb4a0237$var$log("Before unload");
        endSession();
    // Promise.all([
    //     flushEvents,
    //     endSession
    // ])
    };
    // Attach event listeners for load and unload events
    window1.addEventListener("load", handlePageLoad);
    window1.addEventListener("visibilitychange", handleVisibilityChange);
    window1.addEventListener("beforeunload", handleBeforeUnload);
    document1.addEventListener("click", handleDocumentClick);
/****************************** SESSION MANAGEMENT END******************************* */ }
$d3928351bb4a0237$var$init(window, document);



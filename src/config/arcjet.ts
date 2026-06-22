import arcjet, {shield, detectBot, slidingWindow} from "@arcjet/node";

if(!process.env.ARCJET_KEY && process.env.NODE_ENV !== 'test'){
    throw new Error(('ARCJET_KEY is not defined'));
}

const aj = arcjet({
    // Get your site key from https://app.arcjet.com and set it as an environment
    // variable rather than hard coding.
    key: process.env.ARCJET_KEY!,
    rules: [
        // Shield protects your app from common attacks e.g. SQL injection
        shield({ mode: "LIVE" }),
        // Create a bot detection rule
        detectBot({
            mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
            // Block all bots except the following
            allow: [
                "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc
                // Uncomment to allow these other common bot categories
                // See the full list at https://arcjet.com/bot-list
                //"CATEGORY:MONITOR", // Uptime monitoring services
                "CATEGORY:PREVIEW"
            ],
        }),
        // Burst limit. The dashboard fans out ~7 concurrent requests on load
        // (users/subjects/departments/classes + 3 stats calls), so a max of 5
        // would 429 a fresh page load. 30/2s still blocks flood traffic.
        slidingWindow({
            mode:"LIVE",
            interval:'2s',
            max:30,
        })
    ],
});

export default aj;
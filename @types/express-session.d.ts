import 'express';
import session from 'express-session';
declare module 'express' {
    interface Request {
        session?: session.Session
        & { passport?: { user?: any } }
        & { projectTypes: any[] }
        & { imageEditingTools: any[] }
        & { newlyCreatedPhotographers: any[] }
        & { imagingPlatforms: any[] }
        & { message:string}
    }
}



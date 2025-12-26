export interface User { 
    UserID: string,
    FullName: string,
    Email: string,
    UserType: string
}

export interface Passport { 
    user: User
}

export interface Session {
    newlyCreatedPhotographers: any;
    projectTypes: string[]; 
    passport: Passport;
    imagingPlatforms: string[],
    imageEditingTools: string[];
    save: Function;
}

export interface Request { 
    session:Session
}

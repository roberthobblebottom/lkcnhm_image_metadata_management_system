export interface User { 
    UserID: string,
    FullName: string,
    Email: string,
    UserType: string
}

export interface Passport { 
    user: User
}


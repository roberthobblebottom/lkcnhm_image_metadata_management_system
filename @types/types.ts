
export interface User { 
    UserID: string,// TODO should this be number?
    FullName: string,
    Email: string,
    UserType:string
}

//Extends Response and Request interfaces from express js
declare global {
  namespace Express {
    interface Response {
        render: (view?: string, options?: object, title?: string, userTypes?: string[]) => void;
        download: (filePath: string) => void;
    }
  }
}
declare global {
  namespace Express {
    interface Request {
        body: any;
        file: { path: string };
        flash: ( arg0: string, message: string )=>void;
    }
  }
}



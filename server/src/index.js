import dotenv from 'dotenv'
import connetToDb from "./db/db.js";
import app  from './app.js';

dotenv.config({
    path: './.env'
})

const PORT = process.env.PORT || 8080

//connect to the database 
connetToDb()
.then(()=>{
    app.on("error", (error)=>{
        console.log("mongoDb connection Error", error)
        throw error;
    })
    app.listen(PORT, ()=>{
        console.log(`server is running at http://localhost:${PORT}`)
    })
})
.catch(
    (error)=> {
    console.log("Mongo Db connection failed!!!", error)
}
)

import mergedResolvers from './resolvers/index.js';
import mergedTypeDefs from './typeDefs/index.js';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db/connectDB.js';
import session from 'express-session';
import connectMongo from 'connect-mongodb-session';
import passport from 'passport';

import { buildContext } from 'graphql-passport';
import path from 'path';
import { configurePassport } from './passport/passport.config.js';

dotenv.config();
configurePassport();

// job.start();

const __dirname = path.resolve();
// Required logic for integrating with Express
const app = express();
// Our httpServer handles incoming requests to our Express app.
// Below, we tell Apollo Server to "drain" this httpServer,
// enabling our servers to shut down gracefully.
const httpServer = http.createServer(app);
const MongoDBStore = connectMongo(session);

const store = new MongoDBStore({
    uri: process.env.MONGO_URI,
    collection: 'sessions',
});

store.on('error', (err) => console.log(err));
// Same ApolloServer initialization as before, plus the drain plugin
// for our httpServer.

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false, // this option specifies whether to save the session to the store on every request
        saveUninitialized: false, // option specifies whether to save uninitialized sessions
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7, //1 week
            httpOnly: true, // this option prevents the Cross-Site Scripting (XSS) attacks
        },
        store,
    }),
);
app.use(passport.initialize());
app.use(passport.session());

const server = new ApolloServer({
    typeDefs: mergedTypeDefs,
    resolvers: mergedResolvers,
    plugins: [ ApolloServerPluginDrainHttpServer({ httpServer }) ],
});
// Ensure we wait for our server to start
await server.start();

// Set up our Express middleware to handle CORS, body parsing,
// and our expressMiddleware function.
app.use(
    '/graphql',
    cors({
        origin: 'http://localhost:3000',
        credentials: true,
    }),
    express.json(),
    // expressMiddleware accepts the same arguments:
    // an Apollo Server instance and optional configuration options
    expressMiddleware(server, {
        context: async ({ req, res }) => buildContext({ req, res }),
    }),
);

// npm run build will build your frontend app, and it will the optimized version of your app
app.use(express.static(path.join(__dirname, 'frontend/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
});


// Modified server startup
await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
await connectDB();

console.log(`🚀 Server ready at http://localhost:4000/graphql`);
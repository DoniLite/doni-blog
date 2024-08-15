import fastify, { FastifyInstance, RouteShorthandOptions } from "fastify";
import view from "@fastify/view";
import ejs from "ejs";
import staticPlugin from "@fastify/static";
import fromBody from "@fastify/formbody";
import session from "@fastify/session";
import fastifyCookie from "@fastify/cookie";
import path from "node:path";
import { prismaClient } from "./config/db";
import { ReqParams } from "./@types";
import { index } from "./routes";
import cors from "@fastify/cors";
import { home } from "./routes/home";
import { homeControler } from "./controller/home";
import dotEnv from "dotenv"
import { siteUrls } from "./controller/siteUrls";
import fastifyJwt from "@fastify/jwt";
import { store } from "./controller/store";
import { notifications } from "./controller/notifications";
import { webhooks } from "./controller/webhooks";
import { sessionStorageHook } from "./hooks/sessionStorage";
import { about, license, policy, terms } from "./routes/assets";
import { stats } from "./hooks/statCounter";
import { articlePost } from "./controller/articlePost";
import { projectPost } from "./controller/projectPost";
import { article } from "./routes/blog";
import { on, EventEmitter } from "node:events";
import { listeners } from "node:process";
import { PosterTask } from "./hooks/callTasks";
import { customCreateHash, encrypt, graphicsUploader } from "./utils";
import { connexion, registrationController, registrationView } from "./controller/api.v1";
import { urlVisitor } from "./controller/pushVisitor";
import { poster, requestComponent } from "./routes/poster";


export const ee = new EventEmitter();
const protectedRoutes = [
  "/api/v1",
  "/api/notifications",
  "/api/store",
  "/api/webhooks",
];
dotEnv.config()
const server : FastifyInstance = fastify();

server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
})

// Hooks...
server.addHook("onRequest", async (req, res) => {
  const url = req.raw.url;
  if (protectedRoutes.includes(url)) {
    try {
      await req.jwtVerify();
    } catch (err) {
      if (process.env.NODE_ENV == 'production') {
        res.send({err: "Une erreur s'est produite i se peut que vous ne soyez pas disposé à accéder à ceci"})
      }
      res.send(err);
    }
  }
});

server.addHook('onResponse', async (req, res) => {
  const cookieExpriration = new Date();
  cookieExpriration.setMinutes(cookieExpriration.getMinutes() + 15);
  req.session.Token = encrypt(
    Date.now().toString(),
    req.session.ServerKeys.secretKey,
    req.session.ServerKeys.iv
  );
  res.setCookie("connection_time", req.session.Token, {
    expires: cookieExpriration,
  });
})

// server.addHook('onRequest', stats)
server.addHook("preHandler", sessionStorageHook)

export const tokenGenerator = (payload: string) =>  {
  const token = server.jwt.sign({ payload });
  return token
};

server.register(cors, {
  // put your options here
  origin: "*",
  methods:['GET', 'PUT', 'POST'],
  credentials: true,
  cacheControl: "Cache-Control: ${fully}",
});
server.register(view, {
  engine: {
    ejs: ejs,
  },
});
server.register(staticPlugin, {
  root: path.join(path.resolve(__dirname, ".."), "src/public"),
  prefix: "/static/",
});
server.register(fromBody);
server.register(fastifyCookie);
server.register(session, {
  secret: process.env.SESSION_SECRET,
  cookie: {
    secure: false, // true in production for HTTPS
  },
  // saveUninitialized: false,
  // cookieName: "sessionId",
});


// routes...
server.setErrorHandler((err, req, res) => {
  console.log(err);
  res.view("/src/views/error.ejs");
});
server.setNotFoundHandler((req, res) => {
  res.view("/src/views/404.ejs");
})
server.get("/", index);
server.post("/home", homeControler);
server.get("/home", home);
server.post("/sitesUpload", siteUrls);
server.get('/api/token', async (req, res) => {
  const {generator, email, url}: ReqParams = req.query;
  if(!generator) {
    throw new Error('generator is missing in the query string');
  }
  const tokenChecked = await prismaClient.generatorData.findUnique({
    where: {
      name: generator.toLowerCase(),
    },
  });
  if(tokenChecked) {
    return res.send(JSON.stringify({tokenError: 'Invalid token Attribute'}));
  }
  const newTokenHandler = await prismaClient.generatorData.create({
    data: {
      name: generator.toLowerCase(),
      email: email,
      url: url,
    }
  })
  console.log(newTokenHandler)
  const token = tokenGenerator(generator);
  res.send(JSON.stringify({token}));
})
server.get('/api/webhooks', webhooks)
server.post('/api/store', store)
server.post("/api/notifications", notifications)

server.get('/article', article)
server.post("/articlePost", articlePost);
server.post("/projectPost", projectPost);

server.get('/terms', terms)
server.get('/privacy', policy)
server.get('/license', license)
server.get('/about', about)
server.get('/signin', connexion)
server.get('/register', registrationView)
server.post("/register", registrationController);
server.get('/poster', poster)
server.get("/components/poster", requestComponent);

server.get('/update/visitor', urlVisitor)

const port = parseInt(process.env.PORT) || 3081;
server.listen({ port: port, host: '0.0.0.0' }, async (err, address) => {
  // trying to make requests to the server
  const rep = await server.inject("/");

  // log the result of the request
  // console.log(rep)
  process.nextTick(async() => {
    const urls = await prismaClient.url.findMany()
    ee.emit("evrymorningAndNyTask", "begenning the task...");
    const respFTask = await PosterTask();
    console.log(respFTask)
  });
  for await (const event of on(ee, "evrymorningAndNyTask")) {
    // The execution of this inner block is synchronous and it
    // processes one event at a time (even with await). Do not use
    // if concurrent execution is required.
    console.log(event); // prints ['bar'] [42]
  }
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
  setInterval(() => {
    console.log('tic')
  }, 2000)
});

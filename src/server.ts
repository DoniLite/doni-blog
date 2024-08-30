import fastify, { FastifyInstance } from 'fastify';
import view from '@fastify/view';
import ejs from 'ejs';
import staticPlugin from '@fastify/static';
import fromBody from '@fastify/formbody';
import session from '@fastify/session';
import fastifyCookie from '@fastify/cookie';
import path from 'node:path';
import { prismaClient } from './config/db';
import { ReqParams } from './@types';
import { index } from './routes';
import cors from '@fastify/cors';
import { home } from './routes/home';
import { homeControler } from './controller/home';
import dotEnv from 'dotenv';
import { siteUrls } from './controller/siteUrls';
import fastifyJwt from '@fastify/jwt';
import { store } from './controller/store';
import { notifications } from './controller/notifications';
import { webhooks } from './controller/webhooks';
import { sessionStorageHook } from './hooks/sessionStorage';
import { about, license, policy, terms } from './routes/assets';
import { stats } from './hooks/statCounter';
import { articlePost } from './controller/articlePost';
import { projectPost } from './controller/projectPost';
import { article } from './routes/blog';
import { on, EventEmitter } from 'node:events';
import { encrypt, saveStatistic } from './utils';
import {
  authController,
  connexion,
  registrationController,
  registrationView,
  serviceHome,
} from './controller/api.v1';
import { urlVisitor } from './controller/pushVisitor';
import {
  poster,
  requestComponent,
  requestListComponent,
} from './routes/poster';
import { find } from './controller/finder';
import fastifyWebsocket from '@fastify/websocket';
import { cv } from './controller/cv';
import multipart from '@fastify/multipart';
import { uploadActu } from './controller/actu';
import { assetPoster } from './controller/assetsPost';

export const ee = new EventEmitter();
const protectedRoutes = [
  '/api/v1',
  '/api/v1/auth',
  '/api/v1/playground',
  '/api/v1/poster/save',
  '/api/notifications',
  '/api/store',
  '/api/webhooks',
  '/articlePost',
  '/projectPost',
  '/assetsPost',
];
dotEnv.config();
const server: FastifyInstance =
  fastify();
  // {logger: true}

// Hooks...
server.addHook('onRequest', async (req, res) => {
  const url = req.raw.url;
  if (protectedRoutes.includes(url)) {
    try {
      await req.jwtVerify();
    } catch (err) {
      if (process.env.NODE_ENV == 'production') {
        res.send({
          err: "Une erreur s'est produite i se peut que vous ne soyez pas disposé à accéder à ceci",
        });
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
  res.setCookie('connection_time', req.session.Token, {
    expires: cookieExpriration,
  });
});

server.addHook('preHandler', stats);
server.addHook('preSerialization', async (req) => {
  await saveStatistic(req.session.Stats);
});
server.addHook('preHandler', sessionStorageHook);

export const tokenGenerator = (payload: string) => {
  const token = server.jwt.sign({ payload });
  return token;
};

server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
});
// async function onFile(part: MultipartFile) {
// const ext = path.extname(part.filename);
// const date = new Date();
// const r = randomInt(date.getTime()).toString();
// const name = `${date.getTime().toString() + r}${ext}`
// ee.emit('upload', name);
// console.log(name)
// const dPath = path.resolve(__dirname, '../src/public/uploads');
// const uploadPath = path.join(dPath, name);
//   await pump(part.file, fs.createWriteStream(uploadPath));
// }
server.register(
  multipart
  // { attachFieldsToBody: true, onFile }
);
server.register(fastifyWebsocket);
server.register(async (fastify) => {
  fastify.get('/notifications', { websocket: true }, (socket, req) => {
    socket.on('clientConnection', () => {
      req.session.Services.Platform.Sockets = true;
      req.session.Services.Platform.internals = true;
    });
    socket.on('message', async (mes) => {
      console.log(JSON.parse(mes.toString()));
    });
  });
});
server.register(cors, {
  // put your options here
  origin: '*',
  methods: ['GET', 'PUT', 'POST'],
  credentials: true,
  cacheControl: 'Cache-Control: ${fully}',
});
server.register(view, {
  engine: {
    ejs: ejs,
  },
});
server.register(staticPlugin, {
  root: path.join(path.resolve(__dirname, '..'), 'src/public'),
  prefix: '/static/',
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
  const errorCode = Number(err.code);
  if (errorCode >= 400 && errorCode < 600) {
    res.view('/src/views/error.ejs');
  }
  res.send(JSON.stringify({ error: 'some error' }));
});
server.setNotFoundHandler((req, res) => {
  res.view('/src/views/404.ejs');
});
server.get('/auth/token', async (req, res) => {
  const userId = req.session.UserId;
  const user = await prismaClient.user.findUnique({
    where: {
      email: userId,
    },
  });
  if (user) {
    return res.send(JSON.stringify({ token: user.token }));
  }
  return res.code(404);
});
server.get('/', index);
server.post('/home', homeControler);
server.get('/home', home);
server.post('/sitesUpload', siteUrls);
server.get('/api/token', async (req, res) => {
  const { generator, email, url }: ReqParams = req.query;
  if (!generator) {
    throw new Error('generator is missing in the query string');
  }
  const tokenChecked = await prismaClient.generatorData.findUnique({
    where: {
      name: generator.toLowerCase(),
    },
  });
  if (tokenChecked) {
    return res.send(JSON.stringify({ tokenError: 'Invalid token Attribute' }));
  }
  const newTokenHandler = await prismaClient.generatorData.create({
    data: {
      name: generator.toLowerCase(),
      email: email,
      url: url,
    },
  });
  console.log(newTokenHandler);
  const token = tokenGenerator(generator);
  res.send(JSON.stringify({ token }));
});

// Pages...
server.get('/article', article);
server.get('/terms', terms);
server.get('/privacy', policy);
server.get('/license', license);
server.get('/about', about);

// Admin conn
server.post('/articlePost', articlePost);
server.post('/projectPost', projectPost);
server.post('/assetsPost', assetPoster);

// API
server.get('/signin', connexion);
server.get('/register', registrationView);
server.post('/api/v1/register', registrationController);
server.post('/api/v1/auth', authController);
server.get('/service', serviceHome);
server.get('/poster/new', poster);
server.post('/actu/post', uploadActu);
server.get('/cvMaker', cv);
// Plateform bin
server.get('/api/webhooks', webhooks);
server.post('/api/store', store);
server.post('/api/notifications', notifications);

// Components...
server.get('/components/poster', requestComponent);
server.get('/components/list', requestListComponent);

// features and other thread specific
server.get('/update/visitor', urlVisitor);
server.get('/find', find);

const port = parseInt(process.env.PORT) || 3081;
server.listen({ port: port, host: '0.0.0.0' }, async (err, address) => {
  // trying to make requests to the server
  // const rep = await server.inject("/");

  // log the result of the request
  // console.log(rep)
  ee.on('stats', async (e) => {
    console.log(JSON.parse(e));
    // await saveStatistic(JSON.parse(e));
  });
  process.nextTick(async () => {
    ee.emit('evrymorningAndNyTask', 'begenning the task...');
    // const urls = await prismaClient.url.findMany();
    // const respFTask = await PosterTask();
    // console.log(respFTask);
  });
  for await (const event of on(ee, 'evrymorningAndNyTask')) {
    console.log(event);
  }
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});

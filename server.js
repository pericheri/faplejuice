/*********************************************************************************
*  WEB322 – Assignment 05
*  I declare that this assignment is my own work in accordance with Seneca  Academic Policy.  No part of this
*  assignment has been copied manually or electronically from any other source (including web sites) or 
*  distributed to other students.
* 
*  Name: Rohan Kashyap Student ID: 158391201 Date: 13/4/2023
*
*  Cyclic Web App URL: https://red-creepy-kingfisher.cyclic.app
*
*  GitHub Repository URL: https://github.com/R0hanKashyap/assignment-6
*
********************************************************************************/ 

const express = require('express')
const app = express()
const path = require('path');
const multer = require("multer");
const exphbs = require('express-handlebars')
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier')
const stripJs = require('strip-js');
const authData = require('./auth-service');
const clientSessions = require('client-sessions')
const { getPosts, getCategories, getPublishedPosts,getPublishedPostsByCategory, initialize, addPost, getPostById, getPostsByCategory, getPostsByMinDate, addCategory, deleteCategoryById, deletePostById } = require('./blog-service')

// Setup client-sessions
app.use(clientSessions({
    cookieName: "session",
    secret: "assignment6_web322",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
  }));

cloudinary.config({
    cloud_name: 'mtw',
    api_key: '523873693214562',
    api_secret: 'tmviDLH-5JTBKhZ1cSvE_3f5eYI',
    secure: true
});

app.use(express.urlencoded({extended: true}));

app.engine('.hbs', exphbs.engine({ 
    extname: '.hbs', 
    defaultLayout: "main",
    helpers : {
        navLink: function(url, options) {
            return '<li' +
            ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
            '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
            throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        safeHTML: function(context){
            return stripJs(context);
        },
        formatDate: function(dateObj){
            let year = dateObj.getFullYear();
            let month = (dateObj.getMonth() + 1).toString();
            let day = dateObj.getDate().toString();
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2,'0')}`;
        }
    }

}));
app.set('view engine', '.hbs');
app.set('views', './views');

const upload = multer();

function ensureLogin(req, res, next) {
    if (!req.session.user) {
      res.redirect("/login");
    } else {
      next();
    }
}

app.use(express.static('public'));

app.use(function(req,res,next){
    let route = req.path.substring(1);
    app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
    app.locals.viewingCategory = req.query.category;
    next();
});

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

app.get('/',(req,res) => {
    res.redirect('/blog')
})

app.get('/about',function(req,res) {
    res.render('about');
});

app.get('/posts/add',ensureLogin,function(req,res) {
    getCategories().then((data) => {
        res.render('addPost', { categories: data });
    }).catch((msg) => {
        res.render('addPost', { categories: [] });
    })
});

app.post('/posts/add',ensureLogin,upload.single("featureImage"),function(req,res) {
    let streamUpload = (req) => {
        return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream((error, result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(error);
                    }
                }
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
    };

    async function upload(req) {
        let result = await streamUpload(req);
        console.log(result);
        return result;
    }

    upload(req).then((uploaded)=> {
        req.body.featureImage = uploaded.url;
        const { title, body, category, published, featureImage  } = req.body;
        postData = {
            title, body, category, published, featureImage
        }
        addPost(postData).then((data) => {
            res.redirect('/posts')
        }).catch((err)=> {
            console.log(err);
        })
    });
});

app.get('/categories/add',ensureLogin,function(req,res) {
    res.render('addCategory');
});

app.post('/categories/add',ensureLogin, function(req,res) {
    const { category } = req.body;
    categoryData = {
        category
    }
    addCategory(categoryData).then((data) => {
        res.redirect('/categories');
    }).catch((err)=> {
        console.log(err);
    })
});

app.get('/categories/delete/:id', function(req,res) {
    deleteCategoryById(req.params.id).then(() => {
        res.redirect('/categories');
    }).catch((err)=> {
        console.log(err);
    })
});

app.get('/posts/delete/:id', function(req,res) {
    deletePostById(req.params.id).then(() => {
        res.redirect('/posts');
    }).catch((err)=> {
        console.log(err)
    })
});



app.get('/blog', async (req, res) => {

    let viewData = {};

    try{
        let posts = [];
        if(req.query.category){
            posts = await getPublishedPostsByCategory(req.query.category);
        }else{
            posts = await getPublishedPosts();
        }
        posts.sort((a,b) => new Date(b.postDate) - new Date(a.postDate));
        let post = posts[0]; 
        viewData.posts = posts;
        viewData.post = post;

    }catch(err){
        viewData.message = "no results";
    }

    try{
        let categories = await getCategories();
        viewData.categories = categories;
    }catch(err){
        viewData.categoriesMessage = "no results"
    }
    res.render("blog", {data: viewData})

});

app.get('/blog/:id', async (req, res) => {
    let viewData = {};

    try{
        let posts = [];
        if(req.query.category){
            posts = await getPublishedPostsByCategory(req.query.category);
        }else{
            posts = await getPublishedPosts();
        }
        posts.sort((a,b) => new Date(b.postDate) - new Date(a.postDate));
        viewData.posts = posts;

    }catch(err){
        viewData.message = "no results";
    }

    try{
        const post = await getPostById(req.params.id);
        viewData.post = post[0]
    }catch(err){
        viewData.message = "no results"; 
    }

    try{
        let categories = await getCategories();
        viewData.categories = categories;
    }catch(err){
        viewData.categoriesMessage = "no results"
    }
    res.render("blog", {data: viewData})
});


app.get('/posts',ensureLogin, async (req,res)=> {
    if(req.query.category != null){
        getPostsByCategory(req.query.category).then((posts) => {
            res.render('posts',{ posts })
        }).catch((err)=> {
            res.render("posts", {message: "no results"});
        })
    }

    if(req.query.minDate != null){
        getPostsByMinDate(req.query.minDate).then((posts) => {
            res.render('posts',{ posts })
        }).catch((err)=> {
            res.render("posts", {message: "no results"});
        })
    }

    getPosts().then((posts) => {
        res.render('posts',{ posts })
    }).catch((err)=> {
        res.render("posts", {message: "no results"});
    })
})

app.get('/posts/:value',ensureLogin, async (req,res)=> {
    getPostById(req.params.value).then((posts) => {
        res.json(posts);
    }).catch((err)=> {
        console.log(err);
    })
})

app.get('/categories',ensureLogin, async (req,res)=> {
    getCategories().then((categories) => {
        res.render('categories',{ categories })
    }).catch((err)=> {
        res.render("categories", {message: "no results"});
    })
})

app.get('/login', (req,res)=> {
    res.render('login')
})

app.post('/login', (req,res)=> {
    req.body.userAgent = req.get('User-Agent');
    authData.checkUser(req.body).then(({ userName, email, loginHistory }) => {
        req.session.user = { userName, email, loginHistory }
        res.redirect('/posts')
    }).catch((err) => {
        res.render('login', {errorMessage: err.message, userName: req.body.userName})
    })
})

app.get('/register', (req,res)=> {
    res.render('register')
})

app.post('/register', (req,res)=> {
    authData.registerUser(req.body).then(() => {
        res.render('register', {successMessage: "User created"})
    }).catch((err) => {
        res.render('register', {errorMessage: err.message, userName: req.body.userName})
    })
})

app.get('/logout',ensureLogin, (req,res)=> {
    req.session.reset();
    res.redirect("/login");
})

app.get('/userHistory',ensureLogin, (req,res)=> {
    res.render('useHistory')
})


app.use((req, res) => {
    res.status(404).render("404")
})

const port = process.env.PORT || 8080

initialize().then(authData.initialize).then(() => {
    app.listen(port, () => console.log(`Server is Running on port ${port}`))
}).catch((err)=> {
    console.log(err);
})


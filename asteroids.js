(function () {
    var canvas = document.getElementById('gameCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var context = canvas.getContext('2d');

    var requestAnimationFrame =
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        window.mozRequestAnimationFrame;

    var keysDown = {};

    var titleScreenSceneNode = document.getElementById('titleScreenScene');
    var levelReadySceneNode = document.getElementById('levelReadyScene');
    var gameOverSceneNode = document.getElementById('gameOverScene');
    var creditsSceneNode = document.getElementById('creditsScene');

    /**
     * Enum of game states
     * @type {Object}
     */
    var GameState = {
        TITLE_SCREEN_SCENE: 'TITLE_SCREEN_SCENE',
        MAIN_LEVEL_SCENE: 'MAIN_LEVEL_SCENE',
        WIN_LEVEL_SCENE: 'WIN_LEVEL_SCENE',
        GAME_OVER_SCENE: 'GAME_OVER_SCENE',
        CREDITS_SCENE: 'CREDITS_SCENE',
    };

    /**
     * Enum of asteroid radius values
     * @type {Object}
     */
    var AsteroidRadius = {
        LARGE: 80,
        MEDIUM: 40,
        SMALL: 20,
    };

    /**
     * Enum of asteroid max velocity values
     * @type {Object}
     */
    var AsteroidMaxVelocity = {
        LARGE: 3,
        MEDIUM: 5,
        SMALL: 7,
    };

    /**
     * Enum of points to award for each asteroid size when destroyed
     * @type {Object}
     */
    var AsteroidScore = {
        LARGE: 20,
        MEDIUM: 50,
        SMALL: 100,
    };

    /**
     * Utility function to determine if a given point lies inside a polygon specified by an array of geometry points
     * @param  {Vector}  point          Point to check
     * @param  {Array}   objectGeometry Polygon to check
     * @return {boolean}                true if the point lies inside the polygon, or false if not
     */
    var pointInPolygon = function (point, objectGeometry) {
        var i,
            j = objectGeometry.length - 1;
        var oddNodes = false;

        for (i = 0; i < objectGeometry.length; i++) {
            if (
                ((objectGeometry[i].y < point.y &&
                    objectGeometry[j].y >= point.y) ||
                    (objectGeometry[j].y < point.y &&
                        objectGeometry[i].y >= point.y)) &&
                (objectGeometry[i].x <= point.x ||
                    objectGeometry[j].x <= point.x)
            ) {
                oddNodes ^=
                    objectGeometry[i].x +
                        ((point.y - objectGeometry[i].y) /
                            (objectGeometry[j].y - objectGeometry[i].y)) *
                            (objectGeometry[j].x - objectGeometry[i].x) <
                    point.x;
            }
            j = i;
        }

        return oddNodes;
    };

    /**
     * Basic vector class
     * @param {Number} x
     * @param {Number} y
     */
    var Vector = function (x, y) {
        if (typeof x === 'number') {
            this.x = x;
        } else {
            this.x = 0;
        }

        if (typeof y === 'number') {
            this.y = y;
        } else {
            this.y = 0;
        }
    };

    /**
     * Simple class for managing individual sounds
     * @param {String} src - The path to the sound effect
     */
    var Sound = function (src) {
        this.sound = document.createElement('audio');
        this.sound.src = src;

        // preload sounds if possible (won't work on iOS)
        this.sound.setAttribute('preload', 'auto');

        // hide controls
        this.sound.setAttribute('controls', 'none');
        this.sound.style.display = 'none';

        document.body.appendChild(this.sound);

        this.getSource = function () {
            return this.src;
        };

        this.pause = function () {
            this.sound.pause();
        };

        this.play = function () {
            this.sound.play();
        };

        this.stop = function () {
            this.sound.pause();
            this.sound.currentTime = 0;
        };
    };

    /**
     * Class for manaing all sounds in the application
     */
    var SoundBank = function () {
        var sounds = {};

        /**
         * [add description]
         * @param {[type]} soundName       [description]
         * @param {[type]} soundSrc        [description]
         * @param {[type]} frequencyOfPlay [description]
         */
        this.add = function (soundName, soundSrc, frequencyOfPlay) {
            var i,
                instances = 0,
                soundNode;

            if (sound instanceof Sound) {
                instances = Math.ceil(sound.duration / frequencyOfPlay);

                if (!sounds[soundName]) {
                    sounds[soundName] = [];
                }

                for (i = 0; i < instances; i++) {
                    soundNode = document.createElement('audio');
                    soundNode.src = soundSrc;
                    sounds[soundName].push(new Sound(soundSrc));
                }
            }
        };

        this.play();
    };

    /**
     * Base class for all objects in the game world to inherit from.
     * @param {Vector} position [description]
     * @param {Vector} velocity [description]
     * @param {integer} angle   [description]
     * @param {integer} radius  [description]
     */
    var GameWorldObject = function (position, velocity, angle, radius) {
        this.gameWorldIndex = GameWorld.getObjects().length; // store the location of this object in the array of game world objects for easy removal later; this works because every time a new object is created it gets pushed to the end of the array
        this.position = position || new Vector(); // default position to [0, 0]
        this.velocity = velocity || new Vector(); // default velocity to [0, 0]
        this.angle = angle !== null ? angle : 90; // angle in degrees (convert to radians when drawing); default to 90 degrees (pointing up)
        this.radius = radius || 15; // radius of object
        this.geometry = []; // array of points defining the object's geometry
        this.timesWarped = 0; // number of times this object has wrapped around the screen
    };

    /**
     * Removes the object from the array of game world objects and performs garbage collection
     */
    GameWorldObject.prototype.destroy = function () {
        var i,
            gameWorldObjects = GameWorld.getObjects();

        // remove the object from the game world array
        gameWorldObjects.splice(this.gameWorldIndex, 1);

        // fix all the index locations for all the other objects in the game world
        for (i = this.gameWorldIndex; i < gameWorldObjects.length; i++) {
            gameWorldObjects[i].gameWorldIndex--;
        }

        // do garbage cleanup
        delete this;
    };

    /**
     * Render method for base GameWorldObject
     */
    GameWorldObject.prototype.render = function () {
        context.save();
        context.lineWidth = this.lineWidth || 2;
        context.translate(this.position.x, this.position.y);
        context.rotate((-this.angle * Math.PI) / 180);
        context.translate(-this.position.x, -this.position.y);
        context.beginPath();
        context.fillStyle = this.fillStyle || '#fff';

        // if geometry only contains one point, render an ellipse; otherwise, draw lines between each of the geometry points
        if (this.geometry && this.geometry.length === 1) {
            context.ellipse(
                this.position.x,
                this.position.y,
                this.radius,
                this.radius,
                0,
                0,
                2 * Math.PI
            );
            context.fill();
        } else if (this.geometry && this.geometry.length > 0) {
            context.moveTo(this.geometry[0].x, this.geometry[0].y);
            for (var i = 1; i < this.geometry.length; i++) {
                context.lineTo(this.geometry[i].x, this.geometry[i].y);
            }
            context.closePath();
            context.fill();
            if (this.textureImg) {
                context.clip();
                context.drawImage(
                    this.textureImg,
                    this.position.x - 2 * this.radius,
                    this.position.y - 2 * this.radius,
                    this.textureImg.width,
                    this.textureImg.height
                );
            }
        }
        context.stroke();
        context.restore();
    };

    /**
     * Rotates the object by the number of degrees specified
     * @param  {integer} degrees - Number of degrees to rotate the object
     */
    GameWorldObject.prototype.rotate = function (degrees) {
        if (degrees !== null && typeof degrees === 'number') {
            this.angle += degrees;
            if (this.angle >= 360) {
                this.angle = this.angle % 360;
            } else if (this.angle < 0) {
                this.angle += 360;
            }
        } else {
            // TODO: rotate by some amount set in a game world constant
        }
    };

    /**
     * Convenience method for manually setting the angle of the object
     * @param {integer} angle - Angle (in degrees) to set the object to
     */
    GameWorldObject.prototype.setAngle = function (angle) {
        if (angle !== null && typeof angle === 'number') {
            this.angle = angle;
        }
    };

    /**
     * Convenience method for manually setting the position of the object
     * @param {integer} x - The X position of the object
     * @param {integer} y - The Y position of the object
     */
    GameWorldObject.prototype.setPosition = function (x, y) {
        if (typeof x === 'object' && (y === undefined || y === null)) {
            this.position.x = x.x;
            this.position.y = x.y;
        } else if (typeof x === 'number' && typeof y === 'number') {
            this.position.x = x;
            this.position.y = y;
        }
    };

    /**
     * Moves the object and keeps track of how many times it has warped from one side of the screen to the other
     */
    GameWorldObject.prototype.update = function () {
        var i;

        // add x velocity to x position
        this.position.x += this.velocity.x;

        // if the object goes completely off the screen, warp it to the opposite side (both position and geometry points)
        if (this.position.x > canvas.width) {
            this.position.x -= canvas.width - 1;
            for (i = 0; i < this.geometry.length; i++) {
                this.geometry[i].x -= canvas.width - 1;
            }
            this.timesWarped++;
        } else if (this.position.x < 0) {
            this.position.x += canvas.width - 1;
            for (i = 0; i < this.geometry.length; i++) {
                this.geometry[i].x += canvas.width - 1;
            }
            this.timesWarped++;
        }

        // add y velocity to y position
        this.position.y += this.velocity.y;

        // if the object goes completely off the screen, warp it to the opposite side (both position and geometry points)
        if (this.position.y > canvas.height) {
            this.position.y -= canvas.height - 1;
            for (i = 0; i < this.geometry.length; i++) {
                this.geometry[i].y -= canvas.height - 1;
            }
            this.timesWarped++;
        } else if (this.position.y < 0) {
            this.position.y += canvas.height - 1;
            for (i = 0; i < this.geometry.length; i++) {
                this.geometry[i].y += canvas.height - 1;
            }
            this.timesWarped++;
        }

        // update the geometry points, too
        for (i = 0; i < this.geometry.length; i++) {
            this.geometry[i].x += this.velocity.x;
            this.geometry[i].y += this.velocity.y;
        }
    };

    /**
     * Ship class.
     * @extends {GameWorldObject}
     * @param {Vector} position [description]
     * @param {Vector} velocity [description]
     * @param {integer} angle   [description]
     * @param {integer} radius  [description]
     */
    var Ship = function (position, velocity, angle, radius) {
        // super()
        GameWorldObject.apply(this, arguments);

        // ship settings
        this.acceleration = 0.4; // amount by which to increment the directional velocity
        this.rotationSpeed = 5; // number of degrees to rotate the ship per time cycle
        this.friction = 0.008; // friction only applies to the ship
        this.fireRate = 0.2; // rate at which the ship is allowed to fire bullets (in seconds)
        this.lastFired = Date.now() - this.fireRate * 1000; // pretend like the ship fired before it was spawned so it's ready to fire again as soon as it appears
        this.maxVelocity = 10;
        this.lineWidth = 2;
        this.fillStyle = '#fff';
        this.thrusterSound = new Sound('sounds/thruster2.mp3');
        this.fireSound = new Sound('sounds/fire.wav');

        // create ship geometry (ship faces right by default -- angle = 0)
        this.geometry.push(
            new Vector(this.position.x + this.radius, this.position.y)
        ); // front tip
        this.geometry.push(
            new Vector(
                this.position.x - this.radius,
                this.position.y + (this.radius * 3) / 4
            )
        ); // right wing tip
        this.geometry.push(
            new Vector(this.position.x - this.radius / 2, this.position.y)
        ); // rear indentation point
        this.geometry.push(
            new Vector(
                this.position.x - this.radius,
                this.position.y - (this.radius * 3) / 4
            )
        ); // left wing tip
    };

    // make the ship inherit from the generic GameWorldObject
    Ship.prototype = Object.create(GameWorldObject.prototype);

    // make sure the ship's constructor is its own, not the GameWorldObject's
    Ship.prototype.constructor = Ship;

    /**
     * Ship's accelerate method. If no angle is supplied, accelerate in the direction the ship is pointing.
     * @param {integer} angle - Angle in degrees by which to accelerate the ship (optional)
     */
    Ship.prototype.accelerate = function (angle) {
        if (angle === null || typeof angle !== 'number') {
            angle = this.angle;
        }

        // only accelerate if we're below max velocity
        if (
            Math.sqrt(
                Math.pow(this.velocity.x, 2) + Math.pow(this.velocity.y, 2)
            ) < this.maxVelocity
        ) {
            this.velocity.x +=
                Math.cos(2 * Math.PI * (angle / 360)) * this.acceleration;
            this.velocity.y -=
                Math.sin(2 * Math.PI * (angle / 360)) * this.acceleration;
        }
    };

    /**
     * Fires bullets from the ship
     */
    Ship.prototype.fire = function () {
        // limit bullet firing rate
        if (
            this.lastFired &&
            Date.now() - this.lastFired > this.fireRate * 1000
        ) {
            GameWorld.getObjects().push(
                new Bullet(
                    new Vector(this.position.x, this.position.y),
                    this.angle
                )
            );
            this.lastFired = Date.now();
            this.fireSound.play();
        }
    };

    /**
     * Ship's update method takes friction into account
     */
    Ship.prototype.update = function () {
        var i,
            j,
            asteroid,
            collision = false,
            dx,
            dy,
            distanceApart;
        var gameWorldObjects = GameWorld.getObjects();

        // super.update()
        GameWorldObject.prototype.update.apply(this, arguments);

        // slow the ship down gradually
        this.velocity.x -= this.velocity.x * this.friction;
        this.velocity.y -= this.velocity.y * this.friction;

        // check for collisions between the ship and all asteroids
        for (i = 0; i < gameWorldObjects.length; i++) {
            if (gameWorldObjects[i] instanceof Asteroid) {
                asteroid = gameWorldObjects[i];

                dx = this.position.x - asteroid.position.x;
                dy = this.position.y - asteroid.position.y;
                distanceApart = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

                if (distanceApart < this.radius * 0.9 + asteroid.radius * 0.9) {
                    collision = true;
                }

                // for (j = 0; j < this.geometry.length; j++) {
                // 	if (pointInPolygon(this.geometry[j], asteroid.geometry)) {
                // 		collision = true;
                // 		break;
                // 	}
                // }

                if (collision) {
                    GameWorld.setGameState(GameState.GAME_OVER_SCENE);
                    return;
                }
            }
        }
    };

    /**
     * [Bullet description]
     * @param {Vector} position [description]
     * @param {Vector} velocity [description]
     */
    var Bullet = function (position, angle) {
        // bullet settings
        this.radius = 3;
        this.lineWidth = 2;
        this.fillStyle = '#fff';
        this.maxVelocity = 11; // bullet velocity should be faster than ship's max velocity

        this.velocity = new Vector(
            Math.cos((-Math.PI * angle) / 180) * this.maxVelocity,
            Math.sin((-Math.PI * angle) / 180) * this.maxVelocity
        );

        // super()
        GameWorldObject.call(this, position, this.velocity, angle, this.radius);

        // create geometry (single point which is the same as the position)
        this.geometry.push(new Vector(this.position.x, this.position.y));
    };

    // make the bullet inherit from the generic GameWorldObject
    Bullet.prototype = Object.create(GameWorldObject.prototype);

    // make sure the bullet's constructor is its own, not the GameWorldObject's
    Bullet.prototype.constructor = Bullet;

    /**
     * Override the GameWorldObject's update function so we can detect collisions with asteroids and
     * destroy the bullet if it wraps around the screen more than once
     */
    Bullet.prototype.update = function () {
        var i,
            asteroid,
            collision = false,
            dx,
            dy,
            distanceApart;
        var gameWorldObjects = GameWorld.getObjects();

        // super.update()
        GameWorldObject.prototype.update.apply(this, arguments);

        // check for collisions between the bullet and all asteroids
        for (i = 0; i < gameWorldObjects.length; i++) {
            if (gameWorldObjects[i] instanceof Asteroid) {
                asteroid = gameWorldObjects[i];

                dx = this.position.x - asteroid.position.x;
                dy = this.position.y - asteroid.position.y;
                distanceApart = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));

                if (distanceApart < this.radius * 0.9 + asteroid.radius * 0.9) {
                    collision = true;
                }

                // if (pointInPolygon(this.position, asteroid.geometry)) {
                // 	collision = true;
                // }

                if (collision) {
                    asteroid.explode();

                    // add to the score
                    if (asteroid.radius > AsteroidRadius.MEDIUM) {
                        GameWorld.addToScore(AsteroidScore.LARGE);
                    } else if (asteroid.radius > AsteroidRadius.SMALL) {
                        GameWorld.addToScore(AsteroidScore.MEDIUM);
                    } else {
                        GameWorld.addToScore(AsteroidScore.SMALL);
                    }

                    // remove the bullet from the game world and do garbage cleanup
                    this.destroy();
                    break;
                }
            }
        }

        // destroy the bullet if it goes off the edge of the screen (or should it be if it goes off the screen after it wraps around once?)
        if (this.timesWarped >= 1) {
            this.destroy();
        }
    };

    /**
     * Asteroid class
     * @param {Vector} position [description]
     * @param {Vector} velocity [description]
     * @param {integer} angle   [description]
     * @param {integer} radius  [description]
     */
    var Asteroid = function (position, velocity, angle, radius) {
        // super()
        GameWorldObject.apply(this, arguments);

        // asteroid settings
        this.rotation = Math.random() * 8 - 4;
        var minRadius = (this.radius * 3) / 4;
        var maxRadius = radius;
        var granularity = 20;
        var minVary = 25;
        var maxVary = 75;

        this.textureImg = new Image();
        this.textureImg.src = 'images/asteroid-texture.jpg';
        this.lineWidth = 3;
        this.fillStyle = '#999';

        // loop variables
        var ang;
        var angleVaryPc;
        var angleVaryRadians;
        var angleFinal;
        var x;
        var y;

        // create geometry
        for (ang = 0; ang < 2 * Math.PI; ang += (2 * Math.PI) / granularity) {
            angleVaryPc = Math.random(minVary, maxVary);
            angleVaryRadians =
                (((2 * Math.PI) / granularity) * angleVaryPc) / 100;
            angleFinal = ang + angleVaryRadians - Math.PI / granularity;
            this.radius =
                Math.floor(Math.random() * (maxRadius - minRadius)) + minRadius;
            x = Math.sin(angleFinal) * this.radius;
            y = -Math.cos(angleFinal) * this.radius;
            this.geometry.push(
                new Vector(this.position.x + x, this.position.y + y)
            );
        }
    };
    Asteroid.prototype = Object.create(GameWorldObject.prototype);
    Asteroid.prototype.constructor = Asteroid;

    /**
     * Asteroid's update method rotates the asteroid automatically
     */
    Asteroid.prototype.update = function () {
        // super.update();
        GameWorldObject.prototype.update.apply(this, arguments);

        // rotate the asteroid
        this.rotate(this.rotation);
    };

    /**
     * Asteroid explodes into 3 smaller asteroids, unless it's already too small, and then it disappears
     */
    Asteroid.prototype.explode = function () {
        var i, vx, vy, angle, radius;

        if (this.radius >= AsteroidRadius.MEDIUM) {
            // create 3 new medium asteroids
            for (i = 0; i < 3; i++) {
                vx =
                    Math.random() * AsteroidMaxVelocity.MEDIUM -
                    AsteroidMaxVelocity.MEDIUM / 2;
                vy =
                    Math.random() * AsteroidMaxVelocity.MEDIUM -
                    AsteroidMaxVelocity.MEDIUM / 2;

                // add asteroid to game world
                GameWorld.getObjects().push(
                    new Asteroid(
                        new Vector(this.position.x, this.position.y), // position
                        new Vector(vx, vy), // velocity
                        0, // angle
                        AsteroidRadius.MEDIUM // radius
                    )
                );
            }
        } else if (this.radius >= AsteroidRadius.SMALL) {
            // create 3 new small asteroids
            for (i = 0; i < 3; i++) {
                vx =
                    Math.random() * AsteroidMaxVelocity.SMALL -
                    AsteroidMaxVelocity.SMALL / 2;
                vy =
                    Math.random() * AsteroidMaxVelocity.SMALL -
                    AsteroidMaxVelocity.SMALL / 2;

                // add asteroid to game world
                GameWorld.getObjects().push(
                    new Asteroid(
                        new Vector(this.position.x, this.position.y), // position
                        new Vector(vx, vy), // velocity
                        0, // angle
                        AsteroidRadius.SMALL // radius
                    )
                );
            }
        }

        // remove the asteroid from the game world and do garbage cleanup
        this.destroy();
    };

    /**
     * Main game code
     */
    var GameWorld = (function () {
        // array to hold all the objects in the game
        var gameWorldObjects = [];

        // set the game state to the title screen
        var gameState = GameState.TITLE_SCREEN_SCENE;

        // current level
        var currentLevel;

        // time
        var then = Date.now();
        var now;
        var delta;

        // ship
        var ship;

        // score
        var score;

        /**
         * Increases the score by the specified amount
         * @param  {integer} points - The number of points to add to the score
         */
        var addToScore = function (points) {
            if (typeof points === 'number') {
                score += points;
            }
        };

        /**
         * [endGameOverScene description]
         */
        var endGameOverScene = function () {
            gameOverSceneNode.style.display = 'none';
        };

        /**
         * [endTitleScreenScene description]
         */
        var endTitleScreenScene = function () {
            titleScreenSceneNode.style.display = 'none';
        };

        /**
         * [endlevelReadyScene description]
         */
        var endlevelReadyScene = function () {
            levelReadySceneNode.style.display = 'none';
        };

        /**
         * Randomizes asteroid position and velocity
         * @param  {integer} numAsteroids - The number of asteroids to generate
         */
        var generateAsteroids = function (numAsteroids) {
            if (!numAsteroids) {
                numAsteroids = 5;
            }

            var i, j, px, py, dx, dy, vx, vy;
            var placementTooClose, numRetries;

            for (i = 0; i < numAsteroids; i++) {
                // make sure placement of new asteroid is far enough away from all existing objects
                placementTooClose = true;
                numRetries = 0;

                while (placementTooClose && numRetries < 100) {
                    px = Math.random() * canvas.width;
                    py = Math.random() * canvas.height;

                    placementTooClose = false;

                    for (j = 0; j < gameWorldObjects.length; j++) {
                        dx = px - gameWorldObjects[j].position.x;
                        dy = py - gameWorldObjects[j].position.y;

                        if (
                            Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2)) <
                            AsteroidRadius.LARGE * 4
                        ) {
                            placementTooClose = true;
                            numRetries++;
                            break;
                        }
                    }
                }

                // generate velocity
                vx =
                    Math.random() * AsteroidMaxVelocity.LARGE -
                    AsteroidMaxVelocity.LARGE / 2;
                vy =
                    Math.random() * AsteroidMaxVelocity.LARGE -
                    AsteroidMaxVelocity.LARGE / 2;

                // add asteroid to game world
                gameWorldObjects.push(
                    new Asteroid(
                        new Vector(px, py), // position
                        new Vector(vx, vy), // velocity
                        0, // angle
                        AsteroidRadius.LARGE // radius
                    )
                );
            }
        };

        /**
         * Returns an array of all objects in the game world
         * @return {Array} Array containing all the objects in the game world
         */
        var getObjects = function () {
            if (!gameWorldObjects) {
                gameWorldObjects = [];
            }

            return gameWorldObjects;
        };

        /**
         * [handleUserInput description]
         * @param  {[type]} timeRegulationModifier [description]
         */
        var handleUserInput = function (timeRegulationModifier) {
            // left/right keys = rotate left/right
            if (37 in keysDown) {
                ship.rotate(ship.rotationSpeed * timeRegulationModifier * 100);
            } else if (39 in keysDown) {
                ship.rotate(-ship.rotationSpeed * timeRegulationModifier * 100);
            }

            // up key = accelerate
            if (38 in keysDown) {
                ship.accelerate();
                ship.thrusterSound.play();
            } else {
                if (ship.thrusterSound instanceof Sound) {
                    ship.thrusterSound.stop();
                }
            }

            // space key = fire
            if (32 in keysDown) {
                ship.fire();
            }
        };

        /**
         * [initialize description]
         */
        var initialize = function () {
            setUpListeners();
            resetGame();
        };

        /**
         * Set initial positions and velocities for the ship and asteroids
         */
        var initializeGameWorldObjects = function () {
            while (gameWorldObjects.length > 0) {
                gameWorldObjects[0].destroy();
            }

            // create ship
            ship = new Ship(
                new Vector(canvas.width / 2, canvas.height / 2), // position
                new Vector(0, 0), // velocity
                90, // angle
                20 // radius
            );
            gameWorldObjects.push(ship);

            // create asteroids
            generateAsteroids(currentLevel);
        };

        /**
         * [isWinConditionMet description]
         * @return {Boolean} [description]
         */
        var isWinConditionMet = function () {
            var i;

            // if there are no asteroids left, the level has been completed
            for (i = 0; i < gameWorldObjects.length; i++) {
                if (gameWorldObjects[i] instanceof Asteroid) {
                    return false;
                }
            }

            return true;
        };

        /**
         * Render the background and all objects in the game
         */
        var renderGameWorld = function () {
            var i;

            // clear the canvas
            context.clearRect(0, 0, canvas.width, canvas.height);

            // draw ship and asteroids
            for (i = 0; i < gameWorldObjects.length; i++) {
                gameWorldObjects[i].render();
            }

            // render score
            context.fillStyle = '#fff';
            context.font = '20px sans-serif';
            context.textBaseline = 'top';
            context.fillText('Score: ' + score, 20, 20);
        };

        /**
         * Show the credits screen
         */
        var playCreditsScene = function () {
            // TODO
        };

        /**
         * [description]
         */
        var playMainLevelScene = function () {
            if (gameState === GameState.MAIN_LEVEL_SCENE) {
                now = Date.now();
                delta = now - then;

                updateGameWorld(delta / 1000);
                renderGameWorld();

                then = now;

                requestAnimationFrame(playMainLevelScene);
            } else if (gameState === GameState.GAME_OVER_SCENE) {
                playGameOverScene();
            } else if (gameState === GameState.WIN_LEVEL_SCENE) {
                playLevelReadyScene();
            }
        };

        /**
         * Show the game over screen
         */
        var playGameOverScene = function () {
            gameOverSceneNode.style.display = '';
        };

        /**
         * [playNextLevel description]
         */
        var playNextLevel = function () {
            currentLevel++;
            startGame();
        };

        /**
         * Show the title screen
         */
        var playTitleScreenScene = function () {
            // clear the canvas
            context.clearRect(0, 0, canvas.width, canvas.height);

            titleScreenSceneNode.style.display = '';
        };

        /**
         * Show the level won screen
         */
        var playLevelReadyScene = function () {
            var levelTitleNode =
                levelReadySceneNode.getElementsByClassName('scene-title')[0];
            if (levelTitleNode instanceof HTMLHeadingElement) {
                levelTitleNode.innerHTML = 'Level ' + (currentLevel + 1);
            }
            levelReadySceneNode.style.display = '';
        };

        /**
         * Show the title screen and clear out the game world
         * @return {[type]} [description]
         */
        var resetGame = function () {
            while (gameWorldObjects.length > 0) {
                gameWorldObjects[0].destroy();
            }

            endGameOverScene();
            endlevelReadyScene();

            currentLevel = 1;
            score = 0;

            gameState = GameState.TITLE_SCREEN_SCENE;
            playTitleScreenScene();
        };

        /**
         * [setGameState description]
         * @param {GameState} state
         */
        var setGameState = function (state) {
            gameState = state;
        };

        /**
         * [setUpListeners description]
         */
        var setUpListeners = function () {
            // when a key is pressed down, add it to the list of keys down
            addEventListener(
                'keydown',
                function (event) {
                    keysDown[event.keyCode] = true;

                    // enter = toggle full screen mode (and start the game if it's not already started)
                    if (event.which === 13) {
                        switch (gameState) {
                            case GameState.TITLE_SCREEN_SCENE:
                                startGame();
                                break;
                            case GameState.MAIN_LEVEL_SCENE:
                                // do nothing? also pause/un-pause?
                                break;
                            case GameState.GAME_OVER_SCENE:
                                resetGame();
                                break;
                            case GameState.WIN_LEVEL_SCENE:
                                playNextLevel();
                                break;
                            case GameState.CREDITS_SCENE:
                                resetGame();
                                break;
                        }
                    }

                    // f = toggle fullscreen mode
                    if (event.which === 70 || event.which === 102) {
                        toggleFullScreen();
                    }

                    // p = pause/un-pause game
                    if (event.which === 80 || event.which === 112) {
                        pauseGame();
                    }

                    // r = reset game
                    if (event.which === 82 || event.which === 114) {
                        resetGame();
                    }
                },
                false
            );

            // when a key is lifted, remove it from the list of keys down
            addEventListener(
                'keyup',
                function (event) {
                    delete keysDown[event.keyCode];
                },
                false
            );

            // reset the canvas size any time the window is resized
            addEventListener(
                'resize',
                function (event) {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                },
                false
            );
        };

        /**
         * Initialize the ship and asteroids and run the main game loop
         */
        var startGame = function () {
            gameState = GameState.MAIN_LEVEL_SCENE;

            initializeGameWorldObjects();

            endTitleScreenScene();
            endlevelReadyScene();

            playMainLevelScene();
        };

        /**
         * Toggles full screen mode (must be activated by user input -- browsers disable automatically enabling fullscreen mode)
         */
        var toggleFullScreen = function () {
            if (
                !document.fullscreenElement &&
                !document.mozFullScreenElement &&
                !document.webkitFullscreenElement &&
                !document.msFullscreenElement
            ) {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                } else if (document.documentElement.msRequestFullscreen) {
                    document.documentElement.msRequestFullscreen();
                } else if (document.documentElement.mozRequestFullScreen) {
                    document.documentElement.mozRequestFullScreen();
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen(
                        Element.ALLOW_KEYBOARD_INPUT
                    );
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            }
        };

        /**
         * Update all objects in the game world in preparation for re-paint
         * @param  {Number} modifier - Timed step in order to keep the movement flowing smoothly
         */
        var updateGameWorld = function (timeRegulationModifier) {
            var i;

            handleUserInput(timeRegulationModifier);

            // update world object locations
            for (i = 0; i < gameWorldObjects.length; i++) {
                gameWorldObjects[i].update();
            }

            // check to see if the level win conditions are met
            if (isWinConditionMet()) {
                setGameState(GameState.WIN_LEVEL_SCENE);
            }
        };

        return {
            initialize: initialize,
            getObjects: getObjects,
            setGameState: setGameState,
            addToScore: addToScore,
        };
    })();

    // reset the game to the title screen and wait until enter is pressed
    GameWorld.initialize();
})();

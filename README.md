# user-service

This is a Seneca microservice client that integrates with the Seneca user plugin.  

To change the default database configuration copy dbconfig.example.js as dbconfig.mine.js and edit to your hearts content.  Similarly, edit the Seneca configuration copy config.example.js as config.mine.js.

Just use `docker-compose up` to create it, `docker-compose stop` to stop it and `docker-compose start` to start it.  To remove it, use `docker-compose rm -v`.  That's all there is to it!
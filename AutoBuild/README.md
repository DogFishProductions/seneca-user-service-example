#Configurations for Automated Build tasks in Docker Hub
Each sub-directory in here contains the resources necessary to build an image from which their respective containers can be built.  These images should be added to DockerHub so that they can be accessed by the Deploymet docker-compose file.

# Automating the creation of DockerHub images from BitBucket commits

This is a boilerplate setup for an image of your app to be added to DockerHub.  In order for this image to be built you must follow these steps:

1. Log into *DockerHub* and click **Create > Create Automated Build**.
2. Choose the *BitBucket* User/Organisation and repository from which the *DockerHub* repository will be created.  This will be the *BitBucket* repository for the application that has been created/updated using this automated process.  In order for *DockerHub* to be able to 'see' your *Bitbucket* repository you must first have linked accounts from *DockerHub* to *BitBucket* and added an **Automated Build deploy key** as described below.
3. Select the appropriate **Namespace** and **Name** for your *DockerHub* repository.  It is good practice to retain the *BitBucket* repository name as the *DockerHub* repository name.  Add a **Short Description** which must describe briefly the nature of your application. Click **Create**.
4. In the **Build Settings** for your new Automated Deployment select the branch you wish to build from and set the **Dockerfile Location** to point to *this* directory (relative to the root of the BitBucket repository).  Click **Save Changes**.

You can now trigger the first build of your *DockerHub* image by clicking on **Trigger**.  From now on, your image will be re-built every time you commit code to the selected branch in the associated *BitBucket* repository.


# Linking DockerHub to BitBucket
Note that you must create an **RSA SSH key** for *DockerHub* before following these steps.  Once created, copy the new key into this directory.  The Dockerfile *must delete this key from the container* as part of the creation process after cloning the source repository.

1. Log into *DockerHub* and click **Profile > Settings > Linked Accounts & Services**.
2. Click the service you want to link (*Bitbucket*).  The system prompts you to choose between *Public and Private* and *Limited Access*. The *Public and Private* connection type is required if you want to use the Automated Builds.
3. Press Select under *Public and Private* connection type. The system prompts you to enter your service credentials.  Grant the requested access.

You will now find that the **Settings > Services** page in *BitBucket* contains a POST service to *DockerHub*.  You now have to add a **deployment key** to your repository to grant *DockerHub* read-only access to it:

1. Within your *BitBucket* repository, click on **Settings > Deployment keys**.
2. Follow the instructions in the popup to add your public *DockerHub* **SSH key**.  

You will now be able to create **Automated Builds** of your image in *DockerHub* as described above.
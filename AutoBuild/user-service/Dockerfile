# Replace all place-holder strings in <> brackets with the appropriate values.  Update as appropriate.

FROM <source image>

MAINTAINER <your name and email address>
ENV REFRESHED_AT <date last updated>
LABEL name="<base image name>"
LABEL version="<base version>"

# make sure the package repository is up to date and update ubuntu
RUN DEBIAN_FRONTEND=noninteractive sh -c '( \
    apt-get update -q && \
    apt-get -y -q upgrade && \
    apt-get install -y -q apt-utils curl wget vim man-db ssh bash-completion sudo xdg-utils git htop software-properties-common && \
    apt-get clean && apt-get autoclean)' > /dev/null

### SSH SECTION ###
# Make ssh dir
RUN mkdir /root/.ssh/
# Copy over private key, and set permissions
ADD <rsa_key_name> /root/.ssh/<rsa_key_name>
RUN chmod 0600 /root/.ssh/<rsa_key_name>
RUN mv /root/.ssh/<rsa_key_name> /root/.ssh/id_rsa
# Add bitbuckets key to known_hosts
RUN ssh-keyscan bitbucket.org >> /root/.ssh/known_hosts

WORKDIR /home/redjam
# Clone the repo locally
RUN git clone git@bitbucket.org:<namespace/reponame>.git
RUN chown -R redjam:redjam /home/redjam
# Clean up after ourselves
RUN rm -rf /root/.ssh

# supervisor installation && 
# create directory for child images to store configuration in
RUN apt-get -y install supervisor && \
	mkdir -p /var/log/supervisor && \
	mkdir -p /etc/supervisor/conf.d

# supervisor base configuration
ADD supervisor.conf /etc/supervisor.conf

# supervisor app configuration
ADD <ImageName>-supervisor.conf /etc/supervisor/conf.d/<ImageName>-supervisor.conf

# default command
CMD ["supervisord", "-c", "/etc/supervisor.conf"]
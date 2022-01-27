# featws-transpiler

## Required Softwares
- node.js version 10 or higher.  
- node package manager (npm).
- You can get an official guide to download this tools [here](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).

## Initializing the project
- Clone this repository to your local machine.
- Open your local terminal on VScode and type `npm install` to install the required dependencies.
- Go to `example` folder on your local terminal and type `npm start` to run the project.

## What is the rules.featsws file 

The rules.featws file is essential for the proper generation of the rules.grl.

It is necessary to understand some points of the file's syntax so that the transpiler can identify the features and parameters inserted in it.

### Special markers

- The `#`identifies the features created in the features.json file.

- The `$` identifies the parameters created in the parameters.json file.

- The `@` identifies a group.

### Math expressions

The rules.featws file is where you can write the logical and mathematical expressions. It is the guide for the transpiler to interpret the written lines and generate the rules file.

You can create all sorts of expressions and calculations, as shown in the image below.

<img src="images/FEATrulesfeatws.png" width=70% height="auto">

Feel free to use logical and mathematical operators, variables dependent on other variables and groups according to your needs.
